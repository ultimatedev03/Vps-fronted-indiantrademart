import { supabase } from '@/lib/customSupabaseClient';

const isMissingColumnError = (err) => {
  if (!err) return false;
  const message = String(err.message || err.details || err.hint || '').trim();
  const code = String(err.code || '').trim().toUpperCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    /column .* does not exist/i.test(message) ||
    /could not find .* column/i.test(message)
  );
};

const FEATURED_VENDOR_COLUMNS = [
  'id',
  'slug',
  'company_name',
  'owner_name',
  'profile_image',
  'city',
  'state',
  'city_id',
  'state_id',
  'primary_business_type',
  'secondary_business',
  'description',
  'kyc_status',
  'is_verified',
  'verification_badge',
  'is_active',
  'created_at',
].join(', ');

const FEATURED_VENDOR_FALLBACK_COLUMNS = [
  'id',
  'slug',
  'company_name',
  'owner_name',
  'profile_image',
  'city',
  'state',
  'city_id',
  'state_id',
  'primary_business_type',
  'description',
  'kyc_status',
  'is_verified',
  'is_active',
  'created_at',
].join(', ');

const FEATURED_CACHE_TTL_MS = 5 * 60 * 1000;
const featuredVendorCache = new Map();
const featuredVendorPending = new Map();

const getFreshCache = (cache, key) => {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  return null;
};

const mapVendorRow = (v) => {
  const companyName =
    v.company_name ||
    v.owner_name ||
    'Supplier';

  const cityName = v?.city_ref?.name || v.city || '';
  const stateName = v?.state_ref?.name || v.state || '';

  const kyc = String(v.kyc_status || '').toUpperCase();
  const verified = Boolean(v.is_verified) || kyc === 'APPROVED';

  return {
    ...v,
    name: companyName,
    image: v.profile_image || v.image_url || v.avatar_url || '',
    city: cityName,
    state: stateName,
    verified,
    // best-effort fields used by older UI blocks
    rating: null,
    reviews: null,
    description: v.description || v.primary_business_type || v.secondary_business || '',
  };
};

const applyVendorListModifiers = (query, { onlyActive, from = 0, to = null, limit = null }) => {
  let nextQuery = query.order('created_at', { ascending: false });

  if (onlyActive) {
    nextQuery = nextQuery.eq('is_active', true);
  }

  if (to !== null) {
    nextQuery = nextQuery.range(from, to);
  } else if (limit !== null) {
    nextQuery = nextQuery.limit(limit);
  }

  return nextQuery;
};

const fetchVendorRows = async ({ onlyActive, from = 0, to = null, limit = null }) => {
  let res = await applyVendorListModifiers(
    supabase.from('vendors').select(FEATURED_VENDOR_COLUMNS),
    { onlyActive, from, to, limit }
  );

  if (res.error && isMissingColumnError(res.error)) {
    res = await applyVendorListModifiers(
      supabase.from('vendors').select(FEATURED_VENDOR_FALLBACK_COLUMNS),
      { onlyActive, from, to, limit }
    );
  }

  if (res.error && isMissingColumnError(res.error)) {
    res = await applyVendorListModifiers(
      supabase.from('vendors').select('*'),
      { onlyActive, from, to, limit }
    );
  }

  if (res.error) {
    console.error('Error fetching featured vendors:', res.error);
    return [];
  }

  let rows = Array.isArray(res.data) ? res.data : [];
  const hasIsActive = rows.some((r) => Object.prototype.hasOwnProperty.call(r || {}, 'is_active'));
  if (onlyActive && hasIsActive) {
    rows = rows.filter((r) => r?.is_active === true);
  }

  return rows;
};

const isVerifiedVendor = (v) => {
  const kyc = String(v?.kyc_status || '').toUpperCase();
  return Boolean(v?.is_verified) || kyc === 'APPROVED';
};

const sortFeaturedVendors = (rows = []) => {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => {
    const aVerified = isVerifiedVendor(a) ? 1 : 0;
    const bVerified = isVerifiedVendor(b) ? 1 : 0;
    if (aVerified !== bVerified) return bVerified - aVerified;

    const aCreated = Date.parse(a?.created_at || '') || 0;
    const bCreated = Date.parse(b?.created_at || '') || 0;
    if (aCreated !== bCreated) return bCreated - aCreated;

    const aName = String(a?.company_name || a?.owner_name || '').toLowerCase();
    const bName = String(b?.company_name || b?.owner_name || '').toLowerCase();
    return aName.localeCompare(bName);
  });
  return list;
};

export const vendorService = {
  /**
   * Returns vendors from DB but also adds UI-friendly fields:
   * - name (company_name fallback)
   * - image (profile_image fallback)
   * - verified (from is_verified / verification_badge / kyc_status)
   *
   * NOTE: We keep the original DB columns intact by spreading the row.
   */
  getFeaturedVendors: async (options = {}) => {
    const parsedLimit = Number(options?.limit);
    const onlyActive = options?.onlyActive !== false;
    const exhaustive = options?.exhaustive === true;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.max(1, parsedLimit)
      : exhaustive
        ? Number.POSITIVE_INFINITY
        : 6;
    const cacheKey = JSON.stringify({
      limit: Number.isFinite(limit) ? limit : 'all',
      onlyActive,
      exhaustive,
    });
    const cached = getFreshCache(featuredVendorCache, cacheKey);
    if (cached) return cached;

    if (featuredVendorPending.has(cacheKey)) {
      return featuredVendorPending.get(cacheKey);
    }

    const request = (async () => {
      let rows = [];

      if (exhaustive) {
        const pageSize = Number.isFinite(limit) ? Math.min(limit, 1000) : 1000;
        let from = 0;

        while (rows.length < limit) {
          const batch = await fetchVendorRows({
            onlyActive,
            from,
            to: from + pageSize - 1,
          });
          rows.push(...batch);
          if (batch.length < pageSize) break;
          from += pageSize;
        }
      } else {
        rows = await fetchVendorRows({ onlyActive, limit });
      }

      const normalized = sortFeaturedVendors(rows).slice(0, limit).map(mapVendorRow);
      featuredVendorCache.set(cacheKey, {
        data: normalized,
        expiresAt: Date.now() + FEATURED_CACHE_TTL_MS,
      });
      return normalized;
    })();

    featuredVendorPending.set(cacheKey, request);
    try {
      return await request;
    } finally {
      featuredVendorPending.delete(cacheKey);
    }
  },

  getVendorById: async (vendorId) => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*, products(*)')
      .eq('id', vendorId)
      .single();

    if (error) {
      console.error('Error fetching vendor:', error);
      return null;
    }
    return data;
  },

  searchVendors: async ({ serviceSlug, stateSlug, citySlug, query }) => {
    try {
      // Start building the query on 'vendors' table
      let dbQuery = supabase
        .from('vendors')
        .select(`
          *,
          products (*),
          city:city_id (slug, name),
          state:state_id (slug, name)
        `)
        .eq('is_active', true)
        // NOTE: Your schema has kyc_status like APPROVED/PENDING etc (no VERIFIED).
        // So we treat vendor as "verified" if any of these match.
        .or('is_verified.eq.true,verification_badge.eq.true,kyc_status.ilike.APPROVED');

      // 1. Filter by Location (State)
      if (stateSlug) {
        const { data: stateData } = await supabase
          .from('states')
          .select('id')
          .eq('slug', stateSlug)
          .single();

        if (stateData) {
          dbQuery = dbQuery.eq('state_id', stateData.id);
        }
      }

      // 2. Filter by Location (City)
      if (citySlug) {
        const { data: cityData } = await supabase
          .from('cities')
          .select('id')
          .eq('slug', citySlug)
          .single();

        if (cityData) {
          dbQuery = dbQuery.eq('city_id', cityData.id);
        }
      }

      // Execute Vendor Query
      const { data: vendors, error } = await dbQuery;

      if (error) throw error;
      if (!vendors) return [];

      let filteredVendors = vendors;

      if (serviceSlug) {
        const searchTerm = serviceSlug.replace(/-/g, ' ').toLowerCase();

        filteredVendors = vendors.filter((v) => {
          const hasMatchingProduct = v.products?.some(
            (p) =>
              (p.category && p.category.toLowerCase().includes(searchTerm)) ||
              (p.name && p.name.toLowerCase().includes(searchTerm)) ||
              (p.description && p.description.toLowerCase().includes(searchTerm))
          );

          const companyMatch = (v.company_name || '').toLowerCase().includes(searchTerm);
          return hasMatchingProduct || companyMatch;
        });
      }

      if (query) {
        const q = query.toLowerCase();
        filteredVendors = filteredVendors.filter(
          (v) =>
            (v.company_name || '').toLowerCase().includes(q) ||
            v.products?.some((p) => (p.name || '').toLowerCase().includes(q))
        );
      }

      return filteredVendors;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  },

  getVendorsByCity: async ({ citySlug, limit = 24, page = 1 }) => {
    if (!citySlug) return [];

    let cityId = null;
    let cityName = '';

    try {
      const { data: cityData } = await supabase
        .from('cities')
        .select('id, name')
        .eq('slug', citySlug)
        .maybeSingle();

      if (cityData?.id) cityId = cityData.id;
      if (cityData?.name) cityName = cityData.name;
    } catch (e) {
      // ignore; fallback below
    }

    if (!cityName) {
      cityName = String(citySlug || '').replace(/-/g, ' ').trim();
    }

    const from = Math.max(0, (Number(page) - 1) * Number(limit));
    const to = from + Number(limit) - 1;

    let dbQuery = supabase
      .from('vendors')
      .select(
        `
          *,
          city_ref:city_id (name, slug),
          state_ref:state_id (name, slug)
        `
      )
      .eq('is_active', true)
      .order('is_verified', { ascending: false })
      .order('verification_badge', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (cityId && cityName) {
      dbQuery = dbQuery.or(`city_id.eq.${cityId},city.ilike.%${cityName}%`);
    } else if (cityId) {
      dbQuery = dbQuery.eq('city_id', cityId);
    } else if (cityName) {
      dbQuery = dbQuery.ilike('city', `%${cityName}%`);
    }

    const { data, error } = await dbQuery;
    if (error) {
      console.error('Error fetching city vendors:', error);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    return rows.map(mapVendorRow);
  },
};
