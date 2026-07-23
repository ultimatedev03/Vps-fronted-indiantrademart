// ✅ File: src/modules/directory/pages/SearchResults.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams, useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import SearchFilters from '@/modules/directory/components/SearchFilters';
import SearchResultsList from '@/modules/directory/components/SearchResultsList';
import PageSeoFaq from '@/modules/directory/components/PageSeoFaq';
import PillBreadcrumbs from '@/shared/components/PillBreadcrumbs';
import NearbyLocationNav from '@/modules/directory/components/NearbyLocationNav';
import DirectorySearchBar from '@/modules/directory/components/DirectorySearchBar';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { urlParser } from '@/shared/utils/urlParser';
import { Loader2 } from 'lucide-react';
import { dbClient } from '@/lib/dbClient';
import { toAbsoluteSiteUrl } from '@/lib/siteUrl';
import { locationService } from '@/shared/services/locationService';
import { toast } from '@/components/ui/use-toast';
import { buildPageSeoSchema } from '@/modules/directory/seo/pageSeoOverrides';
import {
  getInitialPageSeoOverride,
  loadPageSeoOverride,
} from '@/modules/directory/seo/pageSeoClient';
import { getProductDetailPath } from '@/shared/utils/productRoutes';

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

const cleanMetaText = (value = '') =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const truncateMeta = (value = '', max = 160) => {
  const text = cleanMetaText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
};

const fitSeoPart = (value = '', limit = 60) => {
  const text = cleanMetaText(value);
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, '').trim() || text.slice(0, limit).trim();
};

const buildLocationSeoTitle = (topic = '', location = '') => {
  const maxLength = 60;
  const suffix = ' | IndianTradeMart';
  const locationBudget = maxLength - suffix.length - 14 - ' in '.length;
  const fittedLocation = fitSeoPart(location, locationBudget);
  const geo = fittedLocation ? ` in ${fittedLocation}` : '';
  let cleanTopic = cleanMetaText(topic)
    .replace(/\s*\|\s*IndianTradeMart.*$/i, '')
    .trim();
  if (!/\b(supplier|manufacturer|service provider)s?\b/i.test(cleanTopic)) {
    cleanTopic = `${cleanTopic} Suppliers`.trim();
  }
  const available = maxLength - suffix.length - geo.length;
  const fittedTopic = fitSeoPart(cleanTopic, available);
  return `${fittedTopic || 'B2B Suppliers'}${geo}${suffix}`;
};

const buildSeoKeywords = (...values) => {
  const seen = new Set();
  return values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => cleanMetaText(value))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40)
    .join(', ');
};

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

const productMatchesLocation = (product, stateId, districtId, cityId) => {
  if (!stateId && !districtId && !cityId) return true;
  if (product?.vendors?.all_india_visibility || product?.vendorAllIndiaVisibility) return true;

  const vendorStateId = product?.vendors?.state_id ? String(product.vendors.state_id) : '';
  const vendorDistrictId = product?.vendors?.district_id ? String(product.vendors.district_id) : '';
  const vendorCityId = product?.vendors?.city_id ? String(product.vendors.city_id) : '';

  if (cityId) return vendorCityId === String(cityId);
  if (districtId) return vendorDistrictId === String(districtId);
  if (stateId) return vendorStateId === String(stateId);
  return true;
};

const resolveCategoryContext = async (slug) => {
  const s = String(slug || '').trim();
  if (!s) return { type: 'text' };

  const [microRes, subRes, headRes] = await Promise.all([
    dbClient.from('micro_categories').select('id, sub_category_id').eq('slug', s).maybeSingle(),
    dbClient.from('sub_categories').select('id, head_category_id').eq('slug', s).maybeSingle(),
    dbClient.from('head_categories').select('id').eq('slug', s).maybeSingle(),
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

const applyLocationFilters = (query, stateId, districtId, cityId) => {
  return query;
};

const buildKeywordProductQuery = ({ selectString, stateId, districtId, cityId }) => {
  let query = dbClient
    .from('products')
    .select(selectString)
    .eq('status', 'ACTIVE')
    .eq('vendors.is_active', true);

  query = applyLocationFilters(query, stateId, districtId, cityId);
  return query;
};

const normalizeDedupePart = (value = '') => slugify(normalizeText(value));

const canonicalDedupeName = (value = '') =>
  normalizeDedupePart(value)
    .replace(/-(service|services|supplier|suppliers|manufacturer|manufacturers|product|products)$/g, '');

const getFirstImageDedupePart = (row = {}) => {
  const raw = row?.images;
  const pick = (value) => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return value.url || value.image_url || value.src || '';
    return '';
  };

  if (Array.isArray(raw)) return normalizeDedupePart(pick(raw[0]));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeDedupePart(pick(parsed[0]));
    } catch (_) {
      return normalizeDedupePart(raw);
    }
  }

  return normalizeDedupePart(row?.image || row?.image_url || '');
};

const getProductDedupeKeys = (row = {}) => {
  const vendorNameKey = normalizeDedupePart(
    row?.vendorName ||
      row?.vendor_name ||
      row?.vendors?.company_name ||
      row?.company_name
  );
  const vendorIdKey = normalizeDedupePart(
      row?.vendorId ||
      row?.vendor_id ||
      row?.vendors?.id
  );
  const vendorKeys = [vendorNameKey, vendorIdKey].filter(Boolean);
  const nameKey = canonicalDedupeName(row?.name || row?.product_name || row?.title || row?.slug);
  const stableKey = normalizeDedupePart(row?.id || row?.slug);
  const categoryKey = normalizeDedupePart(row?.category_slug || row?.category || row?.micro_category_name);
  const priceKey = normalizeDedupePart(row?.price);
  const unitKey = normalizeDedupePart(row?.price_unit || row?.qty_unit || row?.unit);
  const imageKey = getFirstImageDedupePart(row);
  const keys = [];

  vendorKeys.forEach((vendorKey) => {
    if (nameKey) keys.push(`vendor-name:${vendorKey}:${nameKey}`);
    if (imageKey) keys.push(`vendor-image:${vendorKey}:${imageKey}`);
  });
  if (stableKey) keys.push(`product:${stableKey}`);
  if (!vendorKeys.length && (nameKey || imageKey)) keys.push(`loose:${nameKey}:${categoryKey}:${priceKey}:${unitKey}:${imageKey}`);

  return Array.from(new Set(keys.filter(Boolean)));
};

const getProductDedupeKey = (row = {}) => {
  return getProductDedupeKeys(row)[0] || '';
};

const isPreferredProductRow = (candidate = {}, current = {}) => {
  const candidateSlot = Number(candidate?.premium_slot_rank || candidate?.vendors?.premium_slot_rank || 0);
  const currentSlot = Number(current?.premium_slot_rank || current?.vendors?.premium_slot_rank || 0);
  if (candidateSlot !== currentSlot) return candidateSlot > currentSlot;

  const candidateScore = Number(candidate?.__sortScore || candidate?.search_score || 0);
  const currentScore = Number(current?.__sortScore || current?.search_score || 0);
  if (candidateScore !== currentScore) return candidateScore > currentScore;

  const candidatePlan = candidateSlot > 0 ? Number(candidate?.vendor_plan_priority || candidate?.vendors?.plan_priority || 0) : 0;
  const currentPlan = currentSlot > 0 ? Number(current?.vendor_plan_priority || current?.vendors?.plan_priority || 0) : 0;
  if (candidatePlan !== currentPlan) return candidatePlan > currentPlan;

  const candidateUpdated = new Date(candidate?.updated_at || candidate?.created_at || 0).getTime() || 0;
  const currentUpdated = new Date(current?.updated_at || current?.created_at || 0).getTime() || 0;
  return candidateUpdated > currentUpdated;
};

const dedupeProducts = (rows = []) => {
  const keyToIndex = new Map();
  const unique = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const keys = getProductDedupeKeys(row);
    if (!keys.length) return;

    const existingIndex = keys
      .map((key) => keyToIndex.get(key))
      .find((index) => Number.isInteger(index));

    if (Number.isInteger(existingIndex)) {
      if (isPreferredProductRow(row, unique[existingIndex])) {
        unique[existingIndex] = row;
      }
      keys.forEach((key) => keyToIndex.set(key, existingIndex));
      return;
    }

    const nextIndex = unique.length;
    unique.push(row);
    keys.forEach((key) => keyToIndex.set(key, nextIndex));
  });

  return unique;
};

const runKeywordQuery = async ({ selectString, stateId, districtId, cityId, applyFilter }) => {
  try {
    let query = buildKeywordProductQuery({ selectString, stateId, districtId, cityId });
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

const runKeywordOrQuery = async ({ selectString, stateId, districtId, cityId, clauses }) => {
  const orFilter = buildOrFilterString(clauses);
  if (!orFilter) return [];

  try {
    let query = buildKeywordProductQuery({ selectString, stateId, districtId, cityId });
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

const runCategoryContextQuery = async ({ ctx, selectString, stateId, districtId, cityId }) => {
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

  let query = dbClient
    .from('products')
    .select(selectString)
    .eq('status', 'ACTIVE')
    .eq('vendors.is_active', true)
    .eq(filterColumn, filterValue);

  query = applyLocationFilters(query, stateId, districtId, cityId);

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
    districtSlug: '',
    citySlug: '',
  });

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchNotice, setSearchNotice] = useState(null);
  const [seoMeta, setSeoMeta] = useState(null);
  const [seoOverride, setSeoOverride] = useState(() =>
    getInitialPageSeoOverride(location.pathname)
  );

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
  const rawLocationQuery = String(
    searchParams.get('location') || searchParams.get('loc') || searchParams.get('city') || ''
  ).trim();
  const locationQuerySlug = rawLocationQuery ? slugify(rawLocationQuery) : '';

  const autoCorrectedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setSeoOverride(getInitialPageSeoOverride(location.pathname));
    loadPageSeoOverride(location.pathname).then((record) => {
      if (alive) setSeoOverride(record);
    });
    return () => {
      alive = false;
    };
  }, [location.pathname]);

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

  const buildSearchUrl = (svc, st, ct, district = '') => {
    if (!svc) return '/directory';
    let u = `/directory/search/${svc}`;
    if (!st && ct) {
      const q = new URLSearchParams();
      q.set('location', ct);
      return `${u}?${q.toString()}`;
    }
    if (st) u += `/${st}`;
    if (district) u += `/${district}`;
    if (ct) u += `/${ct}`;
    return u;
  };

  useEffect(() => {
    let alive = true;

    const resolveStateTailSeo = async (seoParts) => {
      const prefixSlug = String(seoParts?.prefixSlug || '').trim();
      const stateSlug = String(seoParts?.stateSlug || '').trim();
      if (!prefixSlug || !stateSlug) {
        return { service: '', state: stateSlug, district: '', city: '' };
      }

      let service = prefixSlug;
      let city = '';

      try {
        const { state: stateRow } = await locationService.getLocationBySlug(stateSlug, '');
        const cities = stateRow?.id ? await locationService.getCities(stateRow.id) : [];
        const cityMatch = (cities || [])
          .filter((row) => row?.slug)
          .sort((a, b) => String(b.slug).length - String(a.slug).length)
          .find((row) => prefixSlug === row.slug || prefixSlug.endsWith(`-${row.slug}`));

        if (cityMatch?.slug) {
          city = cityMatch.slug;
          service =
            prefixSlug === city
              ? ''
              : prefixSlug.slice(0, -(city.length + 1)).replace(/-+/g, '-').replace(/^-|-$/g, '');
        }
      } catch (error) {
        console.warn('Legacy state-tail SEO location lookup failed:', error?.message || error);
      }

      return { service, state: stateSlug, district: '', city };
    };

    const parseRouteParams = async () => {
      let service = '';
      let state = '';
      let district = '';
      let city = '';

      if (params.service) {
        service = params.service;
        state = params.state || '';
        district = params.district || '';
        city = params.city || '';
        if (!city && !district && locationQuerySlug) {
          city = locationQuerySlug;
        }
      } else if (params.slug) {
        const stateTailSeo = urlParser.parseStateTailSeoSlug(params.slug);
        if (stateTailSeo?.serviceSlug) {
          ({ service, state, district, city } = await resolveStateTailSeo(stateTailSeo));
        } else {
          const parsed = urlParser.parseSeoSlug(params.slug);
          service = parsed?.serviceSlug || '';
          state = parsed?.stateSlug || '';
          city = parsed?.citySlug || '';
        }
      } else {
        const lastPathSegment = String(location.pathname || '').split('/').filter(Boolean).pop() || '';
        const legacySeo = urlParser.parseLegacySeoSlug(lastPathSegment);
        if (legacySeo?.serviceSlug) {
          service = legacySeo.serviceSlug;
          state = legacySeo.stateSlug || '';
          city = legacySeo.citySlug || '';
          if (!city && !state && legacySeo.locationSlug) {
            city = legacySeo.locationSlug;
          }
        } else {
          const stateTailSeo = urlParser.parseStateTailSeoSlug(lastPathSegment);
          if (stateTailSeo?.serviceSlug) {
            ({ service, state, district, city } = await resolveStateTailSeo(stateTailSeo));
          }
        }
      }

      if (!alive) return;

      setParsedParams({
        serviceSlug: service || '',
        stateSlug: state || '',
        districtSlug: district || '',
        citySlug: city || '',
      });

      autoCorrectedRef.current = false;
    };

    parseRouteParams();

    return () => {
      alive = false;
    };
  }, [params, location.pathname, location.search, locationQuerySlug]);

  const tryAutoCorrect = async ({ wrongSlug, stateSlug, districtSlug, citySlug }) => {
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
      const { data, error } = await dbClient
        .from(table)
        .select('id, name, slug')
        .or(`slug.ilike.%${tok}%,name.ilike.%${tok}%`)
        .limit(800);

      if (!error && Array.isArray(data)) addRows(data);
    };

    const fetchFromProducts = async (tok) => {
      const { data, error } = await dbClient
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

    const correctedUrl = buildSearchUrl(best.slug, stateSlug, citySlug, districtSlug);
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
    districtId,
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
        districtId,
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
        districtId,
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
        districtId,
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
      const { data, error } = await dbClient.from(tableName).select('vendor_id, plan_id').in('vendor_id', ids);
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

    const { data: plans, error: plansErr } = await dbClient.from('vendor_plans').select('id, name').in('id', planIds);
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
        setSearchNotice(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setSearchNotice(null);
      setSeoMeta(null);
      try {
        const serviceSlug = parsedParams.serviceSlug;
        const rawServiceText = rawSearchQuery || serviceSlug.replace(/-/g, ' ');
        const servicePhrase = normalizeText(rawServiceText);
        const serviceQuerySlug = slugify(rawServiceText) || serviceSlug;
        const searchTokens = tokenizeSearchTerms(rawServiceText, servicePhrase);

        const [{ state, district, city }, ctx] = await Promise.all([
          locationService.getLocationBySlug(parsedParams.stateSlug, parsedParams.citySlug, parsedParams.districtSlug),
          resolveCategoryContext(serviceSlug),
        ]);
        const stateId = state?.id || null;
        const districtId = district?.id || null;
        const cityId = city?.id || null;

        try {
          let categoryMeta = null;
          if (ctx.type === 'micro') categoryMeta = await directoryApi.getMicroCategoryBySlug(serviceSlug);
          else if (ctx.type === 'sub') categoryMeta = await directoryApi.getSubCategoryBySlug(serviceSlug);
          else if (ctx.type === 'head') categoryMeta = await directoryApi.getHeadCategoryBySlug(serviceSlug);
          setSeoMeta(categoryMeta || null);
        } catch (metaError) {
          console.warn('Category SEO metadata lookup failed:', metaError?.message || metaError);
        }

        const mapHybridRows = (rows = []) => dedupeProducts((Array.isArray(rows) ? rows : []).map((p) => {
          const vendorObj = Array.isArray(p?.vendors) ? p.vendors[0] : p?.vendors;
          const planName = p?.vendorPlanName || p?.vendor_plan_name || vendorObj?.plan_name || '';
          const planPriority = Number(p?.vendor_plan_priority || p?.vendor_plan_priority_score || 0) || getPlanPriority(planName);
          return {
            ...p,
            vendors: vendorObj,
            vendorName: p?.vendorName || vendorObj?.company_name,
            vendorId: p?.vendorId || vendorObj?.id || p?.vendor_id,
            vendorCity: p?.vendorCity || vendorObj?.city,
            vendorState: p?.vendorState || vendorObj?.state,
            vendorAllIndiaVisibility: Boolean(p?.vendorAllIndiaVisibility || vendorObj?.all_india_visibility),
            vendorRating: p?.vendorRating || vendorObj?.seller_rating || 4.5,
            vendorVerified: p?.vendorVerified || vendorObj?.kyc_status === 'VERIFIED' || !!vendorObj?.verification_badge,
            vendorPlanName: planName,
            __planPriority: planPriority,
            __premiumSlotRank: Number(p?.premium_slot_rank || 0),
          };
        }));

        try {
          const hybridPayload = await directoryApi.hybridSearch({
            q: rawServiceText,
            microSlug: ctx.type === 'micro' ? serviceSlug : '',
            stateId,
            districtId,
            cityId,
            sort: '',
            page: 1,
            limit: 30,
          });

          const hybridRows = Array.isArray(hybridPayload?.data) ? hybridPayload.data : [];
          if (hybridPayload?.success && hybridRows.length > 0) {
            const mappedHybridRows = mapHybridRows(hybridRows);

            setSearchNotice(
              hybridPayload?.availability?.exactAvailable === false
                ? {
                    tone: 'amber',
                    title: 'This product is currently not available',
                    message: hybridPayload?.availability?.message || 'You may like these similar products.',
                  }
                : null
            );
            setResults(mappedHybridRows);
            return;
          }
          if (hybridPayload?.success && hybridPayload?.availability?.exactAvailable === false) {
            setSearchNotice({
              tone: 'amber',
              title: `${serviceName || 'This product'} is currently not available`,
              message: `${serviceName || 'This product'} is currently not available in ${locationName || 'this location'}. You may like these similar products.`,
            });
          }
        } catch (hybridError) {
          console.warn('Hybrid search fallback activated:', hybridError?.message || hybridError);
          setSearchNotice(null);
        }

        // ✅ IMPORTANT: include vendor meta columns from DB
        const selectString = `
          *,
          vendors!inner (
            id, company_name, city, state, state_id, district_id, city_id,
            all_india_visibility,
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
                districtId,
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
                districtId,
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
            vendorAllIndiaVisibility: Boolean(vendorObj?.all_india_visibility),
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

        const locationFiltered = mapped.filter((p) => productMatchesLocation(p, stateId, districtId, cityId));

        if (locationFiltered.length === 0) {
          const fallbackScopes = [];
          if (cityId || districtId) {
            fallbackScopes.push({
              label: state?.name ? `${state.name}` : 'nearby locations',
              stateId,
              districtId: '',
              cityId: '',
            });
          }
          if (stateId) {
            fallbackScopes.push({
              label: 'India',
              stateId: '',
              districtId: '',
              cityId: '',
            });
          }

          for (const scope of fallbackScopes) {
            try {
              const fallbackPayload = await directoryApi.hybridSearch({
                q: rawServiceText,
                microSlug: ctx.type === 'micro' ? serviceSlug : '',
                stateId: scope.stateId,
                districtId: scope.districtId,
                cityId: scope.cityId,
                sort: '',
                page: 1,
                limit: 30,
              });
              const fallbackRows = Array.isArray(fallbackPayload?.data) ? fallbackPayload.data : [];
              if (fallbackPayload?.success && fallbackRows.length > 0) {
                setSearchNotice(null);
                setResults(mapHybridRows(fallbackRows));
                return;
              }
            } catch (fallbackError) {
              console.warn('Location fallback search failed:', fallbackError?.message || fallbackError);
            }
          }

          await tryAutoCorrect({
            wrongSlug: serviceSlug,
            stateSlug: parsedParams.stateSlug,
            districtSlug: parsedParams.districtSlug,
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
            const as = a.__sortScore || 0;
            const bs = b.__sortScore || 0;
            if (bs !== as) return bs - as;

            const asp = a.__premiumSlotRank || a.premium_slot_rank || 0;
            const bsp = b.__premiumSlotRank || b.premium_slot_rank || 0;
            if (bsp !== asp) return bsp - asp;

            const ap = asp > 0 ? (a.__planPriority || 0) : 0;
            const bp = bsp > 0 ? (b.__planPriority || 0) : 0;
            if (bp !== ap) return bp - ap;

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
            districtSlug: parsedParams.districtSlug,
            citySlug: parsedParams.citySlug,
          });
        } catch (e) {}

        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [parsedParams.serviceSlug, parsedParams.stateSlug, parsedParams.districtSlug, parsedParams.citySlug, rawSearchQuery]);

  const filteredResults = useMemo(() => {
    let out = dedupeProducts(results);
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
  const districtName = formatName(parsedParams.districtSlug);
  const stateName = formatName(parsedParams.stateSlug);
  const locationName = [cityName, districtName, stateName].filter(Boolean).join(', ');
  const seoLocationName = cityName || districtName || stateName;
  const metaTitle = cleanMetaText(seoMeta?.title || seoMeta?.seo_title);
  const pageHeading =
    seoOverride?.h1 ||
    (serviceName
      ? `${metaTitle || seoMeta?.name || serviceName} Suppliers & Manufacturers${locationName ? ` in ${locationName}` : ''}`
      : 'Search Results');
  const pageTitle =
    seoOverride?.title ||
    (serviceName
      ? buildLocationSeoTitle(metaTitle || seoMeta?.name || serviceName, seoLocationName)
      : 'Search Results | IndianTradeMart');

  const metaDescription = cleanMetaText(seoMeta?.meta_description || seoMeta?.description);
  const pageDescription =
    seoOverride?.description ||
    truncateMeta(
      metaDescription && locationName
        ? `Find ${serviceName} suppliers and manufacturers in ${locationName}. ${metaDescription}`
        : metaDescription ||
          `Find best ${serviceName} suppliers in ${locationName || 'India'}. Get quotes, compare prices and buy from verified manufacturers on IndianTradeMart.`
    );

  const pageKeywords =
    seoOverride?.keywords ||
    buildSeoKeywords(
      seoMeta?.meta_keywords,
      seoMeta?.keywords,
      seoMeta?.meta_tags,
      serviceName,
      serviceName ? `${serviceName} suppliers` : '',
      serviceName ? `${serviceName} manufacturers` : '',
      locationName,
      locationName && serviceName ? `${serviceName} in ${locationName}` : '',
      'IndianTradeMart'
    );

  const canonicalPath = buildSearchUrl(
    parsedParams.serviceSlug,
    parsedParams.stateSlug,
    parsedParams.citySlug,
    parsedParams.districtSlug
  );

  const canonicalUrl = seoOverride?.canonical || toAbsoluteSiteUrl(canonicalPath);
  const defaultSearchSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://indiantrademart.com/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Directory',
            item: 'https://indiantrademart.com/directory',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: pageHeading,
            item: canonicalUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: `How do I find ${serviceName || 'suppliers'} on Indian Trade Mart?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Use the search filters, city pages and vendor profiles to shortlist relevant suppliers and send enquiries.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I contact suppliers directly?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, buyers can submit requirements and contact listed suppliers through Indian Trade Mart enquiry flows.',
            },
          },
        ],
      },
    ],
  };
  const searchSchema = seoOverride
    ? buildPageSeoSchema(seoOverride, {
        items: filteredResults.map((product) => ({
          name: product?.name || product?.product_name || product?.title,
          path: getProductDetailPath(product),
        })),
      })
    : defaultSearchSchema;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content={pageKeywords} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <script type="application/ld+json">{JSON.stringify(searchSchema)}</script>
      </Helmet>

      <div className="min-h-screen bg-neutral-50 pb-16">
        <div className="sticky top-16 z-10 border-b bg-white/95 shadow-sm backdrop-blur">
          <div className="w-[92vw] mx-auto py-1.5 md:py-2">
            <PillBreadcrumbs className="mb-1.5" overrideParams={parsedParams} />

            <div className="mb-1.5 w-[60vw]">
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
                {pageHeading}
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

        <div className="w-[92vw] mx-auto py-4">
          <div className="flex flex-col lg:flex-row gap-6">
            <aside className="w-full lg:w-64 flex-shrink-0 hidden lg:block">
              <SearchFilters filters={filters} setFilters={setFilters} priceBounds={priceBounds} />
            </aside>

            <main className="flex-1">
              {searchNotice ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                  <p className="font-semibold">{searchNotice.title}</p>
                  <p className="mt-1 text-amber-800">{searchNotice.message}</p>
                </div>
              ) : null}

              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#003D82]" />
                </div>
              ) : (
                <SearchResultsList products={filteredResults} city={locationName || stateName} category={serviceName} />
              )}
            </main>
          </div>
        </div>
        <PageSeoFaq schema={searchSchema} />
      </div>
    </>
  );
};

export default SearchResults;
