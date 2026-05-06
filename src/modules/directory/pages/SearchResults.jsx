// ✅ File: src/modules/directory/pages/SearchResults.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams, useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import SearchFilters from '@/modules/directory/components/SearchFilters';
import SearchResultsList from '@/modules/directory/components/SearchResultsList';
import PillBreadcrumbs from '@/shared/components/PillBreadcrumbs';
import NearbyLocationNav from '@/modules/directory/components/NearbyLocationNav';
import DirectorySearchBar from '@/modules/directory/components/DirectorySearchBar';
import { urlParser } from '@/shared/utils/urlParser';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { locationService } from '@/shared/services/locationService';
import { toast } from '@/components/ui/use-toast';

const normalizeText = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stemWord = (w = '') => {
  const s = String(w || '');
  if (s.length <= 3) return s;
  if (s.endsWith('ies') && s.length > 4) return s.slice(0, -3) + 'y';
  if (s.endsWith('es') && s.length > 3) return s.slice(0, -2);
  if (s.endsWith('s') && s.length > 3) return s.slice(0, -1);
  return s;
};

const normalizeForFuzzy = (t) =>
  normalizeText(t)
    .split(' ')
    .filter(Boolean)
    .map(stemWord)
    .join(' ');

const slugify = (text = '') =>
  String(text || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const levenshtein = (a = '', b = '') => {
  a = String(a);
  b = String(b);
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

const productMatchesLocation = (product, stateId, cityId) => {
  if (!stateId && !cityId) return true;

  const vendorStateId = product?.vendors?.state_id ? String(product.vendors.state_id) : '';
  const vendorCityId = product?.vendors?.city_id ? String(product.vendors.city_id) : '';

  if (cityId) return vendorCityId === String(cityId);
  if (stateId) return vendorStateId === String(stateId);
  return true;
};

const resolveCategoryContext = async (slug) => {
  const s = String(slug || '').trim();
  if (!s) return { type: 'text' };

  const [microRes, subRes, headRes] = await Promise.all([
    supabase.from('micro_categories').select('id, sub_category_id').eq('slug', s).maybeSingle(),
    supabase.from('sub_categories').select('id, head_category_id').eq('slug', s).maybeSingle(),
    supabase.from('head_categories').select('id').eq('slug', s).maybeSingle(),
  ]);

  if (microRes?.data?.id) {
    return { type: 'micro', microId: microRes.data.id, subId: microRes.data.sub_category_id || null };
  }

  if (subRes?.data?.id) {
    return { type: 'sub', subId: subRes.data.id, headId: subRes.data.head_category_id || null };
  }

  if (headRes?.data?.id) {
    return { type: 'head', headId: headRes.data.id };
  }

  return { type: 'text' };
};

const isBadRequest400 = (err) => {
  const status = err?.status ?? err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    status === 400 ||
    String(status) === '400' ||
    msg.includes('bad request') ||
    msg.includes('failed to parse') ||
    msg.includes('column') ||
    msg.includes('unknown') ||
    msg.includes('unexpected')
  );
};

// ✅ Plan priority for sorting (Diamond top -> Gold -> Silver -> Certified -> Booster -> Startup -> others)
const getPlanPriority = (planName) => {
  const p = String(planName || '').toLowerCase().trim();
  if (!p) return 0;
  if (p.includes('diamond') || p.includes('dimond')) return 600;
  if (p.includes('gold')) return 500;
  if (p.includes('silver')) return 400;
  if (p.includes('certified')) return 300;
  if (p.includes('booster')) return 200;
  if (p.includes('startup')) return 100;
  if (p.includes('trial')) return 0;
  return 10;
};

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePriceValue = (rawPrice) => toFiniteNumber(rawPrice);

const buildPriceBounds = (items = []) => {
  const prices = (Array.isArray(items) ? items : [])
    .map((row) => parsePriceValue(row?.price))
    .filter((n) => Number.isFinite(n) && n >= 0);

  if (!prices.length) return { min: 0, max: 100000 };

  const min = Math.floor(Math.min(...prices));
  const max = Math.ceil(Math.max(...prices));
  return { min, max: max > min ? max : min + 1 };
};

const applyLocationFilters = (query, stateId, cityId) => {
  let scopedQuery = query;
  if (stateId) scopedQuery = scopedQuery.eq('vendors.state_id', stateId);
  if (cityId) scopedQuery = scopedQuery.eq('vendors.city_id', cityId);
  return scopedQuery;
};

const buildKeywordProductQuery = ({ selectString, stateId, cityId }) => {
  let query = supabase
    .from('products')
    .select(selectString)
    .eq('status', 'ACTIVE')
    .eq('vendors.is_active', true);

  query = applyLocationFilters(query, stateId, cityId);
  return query;
};

const dedupeProducts = (rows = []) => {
  const seen = new Set();
  const unique = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.id || row?.slug || row?.name || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(row);
  });

  return unique;
};

const runKeywordQuery = async ({ selectString, stateId, cityId, applyFilter }) => {
  try {
    let query = buildKeywordProductQuery({ selectString, stateId, cityId });
    query = applyFilter(query);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      if (isBadRequest400(error)) return [];
      throw error;
    }

    return data || [];
  } catch (error) {
    if (isBadRequest400(error)) return [];
    throw error;
  }
};

const sanitizeOrFilterValue = (value = '') =>
  String(value || '')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildOrFilterString = (clauses = []) =>
  Array.from(
    new Set(
      (Array.isArray(clauses) ? clauses : [])
        .map((clause) => {
          const column = String(clause?.column || '').trim();
          const operator = String(clause?.operator || '').trim();
          const value = sanitizeOrFilterValue(clause?.value);
          if (!column || !operator || !value) return '';
          return `${column}.${operator}.${value}`;
        })
        .filter(Boolean)
    )
  ).join(',');

const runKeywordOrQuery = async ({ selectString, stateId, cityId, clauses }) => {
  const orFilter = buildOrFilterString(clauses);
  if (!orFilter) return [];

  try {
    let query = buildKeywordProductQuery({ selectString, stateId, cityId });
    const { data, error } = await query
      .or(orFilter)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      if (isBadRequest400(error)) return [];
      throw error;
    }

    return data || [];
  } catch (error) {
    if (isBadRequest400(error)) return [];
    throw error;
  }
};

const tokenizeSearchTerms = (...values) =>
  Array.from(
    new Set(
      values
        .flatMap((value) =>
          normalizeText(String(value || '').replace(/-/g, ' '))
            .split(' ')
            .map((token) => token.trim())
            .filter((token) => token.length >= 2)
            .flatMap((token) => {
              const stemmed = stemWord(token);
              return stemmed && stemmed !== token ? [token, stemmed] : [token];
            })
        )
        .filter(Boolean)
    )
  ).slice(0, 8);

const runCategoryContextQuery = async ({ ctx, selectString, stateId, cityId }) => {
  let filterColumn = '';
  let filterValue = null;

  if (ctx?.type === 'micro' && ctx.microId) {
    filterColumn = 'micro_category_id';
    filterValue = ctx.microId;
  } else if (ctx?.type === 'sub' && ctx.subId) {
    filterColumn = 'sub_category_id';
    filterValue = ctx.subId;
  } else if (ctx?.type === 'head' && ctx.headId) {
    filterColumn = 'head_category_id';
    filterValue = ctx.headId;
  }

  if (!filterColumn || !filterValue) {
    return [];
  }

  let query = supabase
    .from('products')
    .select(selectString)
    .eq('status', 'ACTIVE')
    .eq('vendors.is_active', true)
    .eq(filterColumn, filterValue);

  query = applyLocationFilters(query, stateId, cityId);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;
  return data || [];
};

const getKeywordRelevanceScore = (product, { servicePhrase, serviceQuerySlug, searchTokens }) => {
  const name = normalizeText(product?.name);
  const category = normalizeText(product?.category || product?.category_slug);
  const description = normalizeText(product?.description);
  const productSlug = slugify(product?.slug || product?.name);
  const categorySlug = slugify(product?.category_slug || product?.category);

  let score = 0;

  if (serviceQuerySlug && productSlug === serviceQuerySlug) score += 1400;
  if (servicePhrase && name === servicePhrase) score += 1300;
  if (serviceQuerySlug && categorySlug === serviceQuerySlug) score += 1000;
  if (servicePhrase && category === servicePhrase) score += 900;

  if (servicePhrase && name.includes(servicePhrase)) score += 350;
  if (servicePhrase && category.includes(servicePhrase)) score += 240;
  if (servicePhrase && description.includes(servicePhrase)) score += 80;

  searchTokens.forEach((token) => {
    if (name.includes(token)) score += 100;
    if (category.includes(token)) score += 70;
    if (description.includes(token)) score += 25;
    if (productSlug.includes(token)) score += 120;
    if (categorySlug.includes(token)) score += 80;
  });

  return score;
};

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [parsedParams, setParsedParams] = useState({
    serviceSlug: '',
    stateSlug: '',
    citySlug: '',
  });

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    priceRange: [0, 100000],
    rating: 0,
    verified: false,
    inStock: false,
  });

  const priceBounds = useMemo(() => buildPriceBounds(results), [results]);
  const rawSearchQuery = String(
    searchParams.get('q') || searchParams.get('query') || searchParams.get('term') || ''
  ).trim();

  const autoCorrectedRef = useRef(false);

  useEffect(() => {
    setFilters((prev) => {
      const range =
        Array.isArray(prev?.priceRange) && prev.priceRange.length === 2
          ? prev.priceRange
          : [priceBounds.min, priceBounds.max];

      const useFreshBounds = range[0] === 0 && range[1] === 100000;
      const nextMin = useFreshBounds
        ? priceBounds.min
        : Math.max(priceBounds.min, Math.min(Number(range[0]) || priceBounds.min, priceBounds.max));
      const nextMax = useFreshBounds
        ? priceBounds.max
        : Math.max(nextMin, Math.min(Number(range[1]) || priceBounds.max, priceBounds.max));

      if (nextMin === range[0] && nextMax === range[1]) return prev;
      return { ...prev, priceRange: [nextMin, nextMax] };
    });
  }, [priceBounds.min, priceBounds.max]);

  const buildSearchUrl = (svc, st, ct) => {
    if (!svc) return '/directory';
    let u = `/directory/search/${svc}`;
    if (st) u += `/${st}`;
    if (ct) u += `/${ct}`;
    return u;
  };

  useEffect(() => {
    let service = '';
    let state = '';
    let city = '';

    if (params.service) {
      service = params.service;
      state = params.state || '';
      city = params.city || '';
    } else if (params.slug) {
      const parsed = urlParser.parseSeoSlug(params.slug);
      service = parsed?.serviceSlug || '';
      state = parsed?.stateSlug || '';
      city = parsed?.citySlug || '';
    }

    setParsedParams({
      serviceSlug: service || '',
      stateSlug: state || '',
      citySlug: city || '',
    });

    autoCorrectedRef.current = false;
  }, [params, location.pathname, location.search]);

  const tryAutoCorrect = async ({ wrongSlug, stateSlug, citySlug }) => {
    if (!wrongSlug) return null;
    if (autoCorrectedRef.current) return null;

    const wrongRaw = String(wrongSlug || '');
    const wrong = normalizeForFuzzy(wrongRaw);
    if (wrong.length < 4) return null;

    const tokens = normalizeText(wrongRaw.replace(/[^a-z0-9]+/g, ' '))
      .split(' ')
      .map((x) => x.trim())
      .filter((x) => x.length >= 3)
      .slice(0, 4);

    const candidateMap = new Map();
    const addCandidate = (slug, name) => {
      if (!slug) return;
      const key = String(slug);
      if (!candidateMap.has(key)) candidateMap.set(key, { slug: key, name: name || slug });
    };
    const addRows = (rows = []) => {
      (rows || []).forEach((r) => {
        if (!r) return;
        addCandidate(r.slug, r.name);
      });
    };

    const fetchFromTable = async (table, tok) => {
      const { data, error } = await supabase
        .from(table)
        .select('id, name, slug')
        .or(`slug.ilike.%${tok}%,name.ilike.%${tok}%`)
        .limit(800);

      if (!error && Array.isArray(data)) addRows(data);
    };

    const fetchFromProducts = async (tok) => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, category_slug')
        .eq('status', 'ACTIVE')
        .or(`category_slug.ilike.%${tok}%,category.ilike.%${tok}%,name.ilike.%${tok}%`)
        .limit(900);

      if (error || !Array.isArray(data)) return;

      for (const p of data) {
        const s = p?.category_slug || slugify(p?.category) || '';
        const nm = p?.category || p?.category_slug || p?.name || s;
        if (s) addCandidate(s, nm);
      }
    };

    for (const tok of tokens) {
      await fetchFromTable('micro_categories', tok);
      await fetchFromTable('sub_categories', tok);
      await fetchFromTable('head_categories', tok);
      await fetchFromProducts(tok);
    }

    const candidates = Array.from(candidateMap.values());
    if (candidates.length === 0) return null;

    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const c of candidates) {
      const candSlug = normalizeForFuzzy(c.slug);
      const candName = normalizeForFuzzy(c.name);

      const d1 = candSlug ? levenshtein(wrong, candSlug) : Number.POSITIVE_INFINITY;
      const d2 = candName ? levenshtein(wrong, candName) : Number.POSITIVE_INFINITY;
      const d = Math.min(d1, d2);

      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
      if (bestDist === 0) break;
    }

    const allowed = Math.max(2, Math.min(6, Math.ceil(wrong.length * 0.3)));
    if (!best || bestDist > allowed) return null;
    if (String(best.slug) === String(wrongSlug)) return null;

    autoCorrectedRef.current = true;

    const correctedUrl = buildSearchUrl(best.slug, stateSlug, citySlug);
    navigate(correctedUrl, { replace: true });

    toast({
      title: 'Auto-corrected search',
      description: `Showing results for "${best.name}" (corrected from "${wrongRaw.replace(/-/g, ' ')}")`,
    });

    return best;
  };

  const runKeywordProductsQueryWithFallback = async ({
    rawServiceText,
    servicePhrase,
    serviceSlug,
    serviceQuerySlug,
    selectString,
    stateId,
    cityId,
  }) => {
    const exactSlugCandidates = Array.from(
      new Set([serviceSlug, serviceQuerySlug].map((value) => String(value || '').trim()).filter(Boolean))
    );
    const textVariants = Array.from(
      new Set([rawServiceText, servicePhrase].map((value) => String(value || '').trim()).filter(Boolean))
    );
    const searchTokens = tokenizeSearchTerms(rawServiceText, servicePhrase);
    const slugTokens = Array.from(
      new Set(searchTokens.map((value) => slugify(value)).filter((value) => value.length >= 2))
    );
    const limitedSearchTokens = searchTokens.slice(0, 6);
    const limitedSlugTokens = slugTokens.slice(0, 6);

    const exactMatches = dedupeProducts(
      await runKeywordOrQuery({
        selectString,
        stateId,
        cityId,
        clauses: [
          ...exactSlugCandidates.flatMap((slug) => [
            { column: 'slug', operator: 'eq', value: slug },
            { column: 'category_slug', operator: 'eq', value: slug },
          ]),
          ...textVariants.flatMap((text) => [
            { column: 'name', operator: 'ilike', value: text },
            { column: 'category', operator: 'ilike', value: text },
          ]),
        ],
      })
    );

    if (exactMatches.length > 0) {
      return exactMatches;
    }

    const broadMatches = dedupeProducts(
      await runKeywordOrQuery({
        selectString,
        stateId,
        cityId,
        clauses: [
          ...textVariants.flatMap((text) => [
            { column: 'name', operator: 'ilike', value: `%${text}%` },
            { column: 'category', operator: 'ilike', value: `%${text}%` },
          ]),
          ...limitedSlugTokens.flatMap((token) => [
            { column: 'slug', operator: 'ilike', value: `%${token}%` },
            { column: 'category_slug', operator: 'ilike', value: `%${token}%` },
          ]),
          ...limitedSearchTokens.flatMap((token) => [
            { column: 'name', operator: 'ilike', value: `%${token}%` },
            { column: 'category', operator: 'ilike', value: `%${token}%` },
            { column: 'description', operator: 'ilike', value: `%${token}%` },
          ]),
        ],
      })
    );

    if (broadMatches.length > 0) {
      return broadMatches;
    }

    return dedupeProducts(
      await runKeywordOrQuery({
        selectString,
        stateId,
        cityId,
        clauses: textVariants.map((text) => ({
          column: 'description',
          operator: 'ilike',
          value: `%${text}%`,
        })),
      })
    );
  };

  // ✅ reads plan from correct table name (vendor_plan_subscriptions OR vendor_plan_subcriptions)
  const buildVendorPlanMap = async (vendorIds) => {
    const ids = (vendorIds || []).filter(Boolean);
    if (ids.length === 0) return new Map();

    const trySubsTable = async (tableName) => {
      const { data, error } = await supabase.from(tableName).select('vendor_id, plan_id').in('vendor_id', ids);
      if (error) return { data: null, error };
      return { data: data || [], error: null };
    };

    let subsResult = await trySubsTable('vendor_plan_subscriptions');
    if (subsResult.error) subsResult = await trySubsTable('vendor_plan_subcriptions');

    if (subsResult.error || !Array.isArray(subsResult.data)) {
      return new Map();
    }

    const subs = subsResult.data;
    const planIds = Array.from(new Set((subs || []).map((s) => s.plan_id).filter(Boolean)));
    if (planIds.length === 0) return new Map();

    const { data: plans, error: plansErr } = await supabase.from('vendor_plans').select('id, name').in('id', planIds);
    if (plansErr || !Array.isArray(plans)) return new Map();

    const planIdToName = new Map((plans || []).map((p) => [p.id, p.name]));
    const vendorIdToPlanName = new Map();

    (subs || []).forEach((s) => {
      const nm = planIdToName.get(s.plan_id);
      if (nm) vendorIdToPlanName.set(s.vendor_id, nm);
    });

    return vendorIdToPlanName;
  };

  useEffect(() => {
    const fetchResults = async () => {
      if (!parsedParams.serviceSlug) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const serviceSlug = parsedParams.serviceSlug;
        const rawServiceText = rawSearchQuery || serviceSlug.replace(/-/g, ' ');
        const servicePhrase = normalizeText(rawServiceText);
        const serviceQuerySlug = slugify(rawServiceText) || serviceSlug;
        const searchTokens = tokenizeSearchTerms(rawServiceText, servicePhrase);

        const [{ state, city }, ctx] = await Promise.all([
          locationService.getLocationBySlug(parsedParams.stateSlug, parsedParams.citySlug),
          resolveCategoryContext(serviceSlug),
        ]);
        const stateId = state?.id || null;
        const cityId = city?.id || null;

        // ✅ IMPORTANT: include vendor meta columns from DB
        const selectString = `
          *,
          vendors!inner (
            id, company_name, city, state, state_id, city_id,
            seller_rating, kyc_status, verification_badge, trust_score,
            gst_verified, year_of_establishment, years_in_business, response_rate,
            is_active
          )
        `;

        const shouldIncludeCategoryMatches = ctx.type !== 'text';
        const shouldIncludeKeywordMatches = Boolean(rawSearchQuery) || ctx.type === 'text';

        const [categoryMatches, keywordMatches] = await Promise.all([
          shouldIncludeCategoryMatches
            ? runCategoryContextQuery({
                ctx,
                selectString,
                stateId,
                cityId,
              })
            : Promise.resolve([]),
          shouldIncludeKeywordMatches
            ? runKeywordProductsQueryWithFallback({
                rawServiceText,
                servicePhrase,
                serviceSlug,
                serviceQuerySlug,
                selectString,
                stateId,
                cityId,
              })
            : Promise.resolve([]),
        ]);

        const data = dedupeProducts([
          ...categoryMatches,
          ...keywordMatches,
        ]);

        const vendorIds = Array.from(
          new Set(
            (data || [])
              .map((p) => {
                const v = p?.vendors;
                if (Array.isArray(v)) return v[0]?.id;
                return v?.id;
              })
              .filter(Boolean)
          )
        );

        const vendorIdToPlanName = await buildVendorPlanMap(vendorIds);

        const mapped = (data || []).map((p) => {
          const v = p?.vendors;
          const vendorObj = Array.isArray(v) ? v[0] : v;
          const vendorId = vendorObj?.id || null;

          const planName = vendorId ? vendorIdToPlanName.get(vendorId) || '' : '';
          const planPriority = getPlanPriority(planName);

          return {
            ...p,
            vendors: vendorObj,
            vendorName: vendorObj?.company_name,
            vendorId,
            vendorCity: vendorObj?.city,
            vendorState: vendorObj?.state,
            vendorRating: vendorObj?.seller_rating || 4.5,
            vendorVerified: vendorObj?.kyc_status === 'VERIFIED' || !!vendorObj?.verification_badge,

            // ✅ vendor meta fields (DB-driven)
            vendorGstVerified: vendorObj?.gst_verified === true || vendorObj?.gst_verified === 1,
            vendorEstablishedYear: vendorObj?.year_of_establishment ?? null, // kept for compatibility
            vendorYearOfEstablishment: vendorObj?.year_of_establishment ?? null, // preferred
            vendorYearsInBusiness: vendorObj?.years_in_business ?? null,
            vendorResponseRate: vendorObj?.response_rate ?? null,

            vendorPlanName: planName,
            __planPriority: planPriority,
          };
        });

        const locationFiltered = mapped.filter((p) => productMatchesLocation(p, stateId, cityId));

        if (locationFiltered.length === 0) {
          await tryAutoCorrect({
            wrongSlug: serviceSlug,
            stateSlug: parsedParams.stateSlug,
            citySlug: parsedParams.citySlug,
          });
          setResults([]);
          return;
        }

        // ✅ SORT:
        // 1) Plan priority (Diamond first, then Gold...)
        // 2) Keyword relevance
        // 3) Rating
        // 4) Latest
        const sorted = locationFiltered
          .map((p) => {
            const relevanceScore = getKeywordRelevanceScore(p, {
              servicePhrase,
              serviceQuerySlug,
              searchTokens,
            });
            return { ...p, __sortScore: relevanceScore };
          })
          .sort((a, b) => {
            const ap = a.__planPriority || 0;
            const bp = b.__planPriority || 0;
            if (bp !== ap) return bp - ap;

            const as = a.__sortScore || 0;
            const bs = b.__sortScore || 0;
            if (bs !== as) return bs - as;

            const ar = Number(a.vendorRating || 0);
            const br = Number(b.vendorRating || 0);
            if (br !== ar) return br - ar;

            const at = a?.created_at ? new Date(a.created_at).getTime() : 0;
            const bt = b?.created_at ? new Date(b.created_at).getTime() : 0;
            return bt - at;
          });

        setResults(sorted);
      } catch (err) {
        console.error('Search failed', err);

        try {
          await tryAutoCorrect({
            wrongSlug: parsedParams.serviceSlug,
            stateSlug: parsedParams.stateSlug,
            citySlug: parsedParams.citySlug,
          });
        } catch (e) {}

        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [parsedParams.serviceSlug, parsedParams.stateSlug, parsedParams.citySlug, rawSearchQuery]);

  const filteredResults = useMemo(() => {
    let out = Array.isArray(results) ? [...results] : [];
    const [minPrice, maxPrice] = Array.isArray(filters?.priceRange)
      ? filters.priceRange
      : [priceBounds.min, priceBounds.max];

    out = out.filter((item) => {
      const priceValue = parsePriceValue(item?.price);
      if (priceValue === null) return true;
      return priceValue >= minPrice && priceValue <= maxPrice;
    });

    if (filters.rating > 0) {
      out = out.filter((item) => {
        const rating = toFiniteNumber(item?.rating) ?? toFiniteNumber(item?.vendorRating) ?? 0;
        return rating >= filters.rating;
      });
    }

    if (filters.verified) {
      out = out.filter((item) => !!item?.vendorVerified);
    }

    return out;
  }, [results, filters, priceBounds.min, priceBounds.max]);

  const formatName = (s) => (s ? s.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : '');
  const serviceName = rawSearchQuery || formatName(parsedParams.serviceSlug);
  const cityName = formatName(parsedParams.citySlug);
  const stateName = formatName(parsedParams.stateSlug);

  const pageTitle = serviceName
    ? `${serviceName} Suppliers & Manufacturers${cityName ? ` in ${cityName}` : ''}${
        stateName && !cityName ? ` in ${stateName}` : ''
      }`
    : 'Search Results';

  const canonicalPath =
    parsedParams.citySlug && parsedParams.stateSlug
      ? `/directory/${parsedParams.serviceSlug}-in-${parsedParams.citySlug}-${parsedParams.stateSlug}`
      : parsedParams.stateSlug
        ? `/directory/${parsedParams.serviceSlug}-in-${parsedParams.stateSlug}`
        : `/directory/${parsedParams.serviceSlug}`;

  const canonicalUrl = `https://www.indiantrademart.com${canonicalPath}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle} | IndianTradeMart</title>
        <meta
          name="description"
          content={`Find best ${serviceName} suppliers in ${cityName || stateName || 'India'}. Get quotes, compare prices and buy from verified manufacturers.`}
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <div className="min-h-screen bg-neutral-50 pb-16">
        <div className="sticky top-16 z-10 border-b bg-white/95 shadow-sm backdrop-blur">
          <div className="container mx-auto px-4 py-1.5 md:py-2">
            <PillBreadcrumbs className="mb-1.5" overrideParams={parsedParams} />

            <div className="mb-1.5 max-w-4xl">
              <DirectorySearchBar
                compact
                enableSuggestions
                className="shadow-sm"
                initialService={parsedParams.serviceSlug}
                initialQuery={rawSearchQuery}
                initialState={parsedParams.stateSlug}
                initialCity={parsedParams.citySlug}
              />
            </div>

            <div className="flex items-start md:items-center justify-between gap-3">
              <motion.h1
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-base md:text-lg font-bold text-gray-900 leading-snug line-clamp-2"
              >
                {pageTitle}
              </motion.h1>

              <div className="flex-shrink-0 text-xs md:text-sm text-gray-500 pt-1 md:pt-0">
                {filteredResults.length} found
              </div>
            </div>

            {parsedParams.stateSlug && (
              <div className="mt-1 overflow-x-auto scrollbar-hide">
                <div className="min-w-max">
                  <NearbyLocationNav
                    serviceSlug={parsedParams.serviceSlug}
                    stateSlug={parsedParams.stateSlug}
                    currentCitySlug={parsedParams.citySlug}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row gap-6">
            <aside className="w-full lg:w-64 flex-shrink-0 hidden lg:block">
              <SearchFilters filters={filters} setFilters={setFilters} priceBounds={priceBounds} />
            </aside>

            <main className="flex-1">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#003D82]" />
                </div>
              ) : (
                <SearchResultsList products={filteredResults} city={cityName || stateName} category={serviceName} />
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
};

export default SearchResults;
