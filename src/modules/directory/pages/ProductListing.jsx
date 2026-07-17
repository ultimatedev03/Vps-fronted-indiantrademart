import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Home, Loader2 } from 'lucide-react';

import DirectorySearchBar from '@/modules/directory/components/DirectorySearchBar';
import SearchFilters from '@/modules/directory/components/SearchFilters';
import SearchResultsList from '@/modules/directory/components/SearchResultsList';

import { directoryApi } from '@/modules/directory/api/directoryApi';
import { locationService } from '@/shared/services/locationService';
import { buildPageSeoSchema } from '@/modules/directory/seo/pageSeoOverrides';
import {
  getInitialPageSeoOverride,
  loadPageSeoOverride,
} from '@/modules/directory/seo/pageSeoClient';

const safeStr = (v) => (typeof v === 'string' ? v.trim() : '');
const stripHtml = (s) => safeStr(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const truncate = (s, n = 160) => {
  const t = stripHtml(s);
  if (!t) return '';
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trim()}…`;
};

const fitSeoPart = (value, limit) => {
  const text = stripHtml(value);
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, '').trim() || text.slice(0, limit).trim();
};

const buildSeoTitle = (topic, location = '') => {
  const maxLength = 60;
  const suffix = ' | IndianTradeMart';
  const locationBudget = maxLength - suffix.length - 14 - ' in '.length;
  const fittedLocation = fitSeoPart(location, locationBudget);
  const geo = fittedLocation ? ` in ${fittedLocation}` : '';
  const cleanTopic = stripHtml(topic)
    .replace(/\s*\|\s*IndianTradeMart.*$/i, '')
    .trim();
  const available = maxLength - suffix.length - geo.length;
  const fittedTopic = fitSeoPart(cleanTopic, available);
  return `${fittedTopic || 'B2B Suppliers'}${geo}${suffix}`;
};

const toTitleCase = (slug) =>
  safeStr(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const buildKeywords = (...items) => {
  const seen = new Set();
  const out = [];
  items
    .flat()
    .filter(Boolean)
    .forEach((item) => {
      String(item)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => {
          const key = s.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            out.push(s);
          }
        });
    });
  return out.join(', ');
};

const numOrNull = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[^0-9.]/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

const parsePriceOrNull = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[^0-9.]/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

const buildPriceBounds = (items = []) => {
  const prices = (Array.isArray(items) ? items : [])
    .map((row) => parsePriceOrNull(row?.price))
    .filter((n) => Number.isFinite(n) && n >= 0);

  if (!prices.length) return { min: 0, max: 100000 };

  const min = Math.floor(Math.min(...prices));
  const max = Math.ceil(Math.max(...prices));
  return { min, max: max > min ? max : min + 1 };
};

const ProductListing = () => {
  const location = useLocation();
  const {
    headSlug,
    subSlug,
    microSlug,
    stateSlug = '',
    districtSlug = '',
    citySlug = '',
  } = useParams();

  const [microInfo, setMicroInfo] = useState(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoOverride, setSeoOverride] = useState(() =>
    getInitialPageSeoOverride(location.pathname)
  );

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);

  const [filters, setFilters] = useState({
    priceRange: [0, 100000],
    rating: 0,
    verified: false,
    inStock: false,
  });
  const priceBounds = useMemo(() => buildPriceBounds(results), [results]);

  const resolvedRef = useRef({ key: '', stateId: null, districtId: null, cityId: null });

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

  const headName = useMemo(
    () => microInfo?.sub_categories?.head_categories?.name || toTitleCase(headSlug),
    [microInfo, headSlug]
  );
  const subName = useMemo(
    () => microInfo?.sub_categories?.name || toTitleCase(subSlug),
    [microInfo, subSlug]
  );
  const microName = useMemo(
    () => microInfo?.name || toTitleCase(microSlug),
    [microInfo, microSlug]
  );
  const locationName = useMemo(
    () => [citySlug, districtSlug, stateSlug].filter(Boolean).map(toTitleCase).join(', '),
    [citySlug, districtSlug, stateSlug]
  );
  const seoLocationName = useMemo(
    () => toTitleCase(citySlug || districtSlug || stateSlug),
    [citySlug, districtSlug, stateSlug]
  );
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
    let alive = true;
    const run = async () => {
      if (!microSlug) return;
      setSeoLoading(true);
      try {
        const m = await directoryApi.getMicroCategoryBySlug(microSlug, { headSlug, subSlug });
        if (!alive) return;
        setMicroInfo(m || null);
      } catch {
        if (!alive) return;
        setMicroInfo(null);
      } finally {
        if (!alive) return;
        setSeoLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [headSlug, subSlug, microSlug]);

  const pageTitle = useMemo(() => {
    if (seoOverride?.title) return seoOverride.title;
    const metaTitle = safeStr(microInfo?.meta_tags);
    return buildSeoTitle(metaTitle || `${microName} Suppliers & Manufacturers`, seoLocationName);
  }, [seoOverride, microInfo, microName, seoLocationName]);

  const pageDescription = useMemo(() => {
    if (seoOverride?.description) return seoOverride.description;
    const metaDesc = safeStr(microInfo?.meta_description);
    if (metaDesc && locationName) {
      return truncate(`Find ${microName} suppliers and manufacturers in ${locationName}. ${metaDesc}`);
    }
    if (metaDesc) return truncate(metaDesc);
    return truncate(`Browse ${microName} products and verified suppliers${locationName ? ` in ${locationName}` : ''} on IndianTradeMart.`);
  }, [seoOverride, microInfo, microName, locationName]);

  const pageKeywords = useMemo(() => {
    if (seoOverride?.keywords) return seoOverride.keywords;
    const metaKw = safeStr(microInfo?.meta_keywords);
    return buildKeywords(
      metaKw,
      microInfo?.meta_tags,
      microName,
      subName,
      headName,
      locationName,
      locationName ? `${microName} suppliers in ${locationName}` : '',
      locationName ? `${microName} manufacturers in ${locationName}` : '',
      'suppliers',
      'manufacturers',
      'IndianTradeMart'
    );
  }, [seoOverride, microInfo, microName, subName, headName, locationName]);

  const canonicalUrl = useMemo(() => {
    if (seoOverride?.canonical) return seoOverride.canonical;
    try {
      const origin = window.location?.origin || '';
      if (!origin) return '';
      let u = `${origin}/directory/${headSlug}/${subSlug}/${microSlug}`;
      if (stateSlug) u += `/${stateSlug}`;
      if (districtSlug) u += `/${districtSlug}`;
      if (citySlug) u += `/${citySlug}`;
      return u;
    } catch {
      return '';
    }
  }, [seoOverride, headSlug, subSlug, microSlug, stateSlug, districtSlug, citySlug]);

  const pageHeading =
    seoOverride?.h1 ||
    `${microName} Suppliers & Manufacturers${locationName ? ` in ${locationName}` : ''}`;
  const pageSchema = seoOverride ? buildPageSeoSchema(seoOverride) : null;

  const resolveLocationIds = async () => {
    const key = `${stateSlug || ''}::${districtSlug || ''}::${citySlug || ''}`;
    if (resolvedRef.current.key === key) return resolvedRef.current;

    try {
      const { state, district, city } = await locationService.getLocationBySlug(stateSlug, citySlug, districtSlug);
      resolvedRef.current = {
        key,
        stateId: state?.id || null,
        districtId: district?.id || null,
        cityId: city?.id || null,
      };
      return resolvedRef.current;
    } catch {
      resolvedRef.current = { key, stateId: null, districtId: null, cityId: null };
      return resolvedRef.current;
    }
  };

  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { stateId, districtId, cityId } = await resolveLocationIds();

        const { data } = await directoryApi.getProductsByMicroAndLocation({
          microSlug,
          stateId,
          districtId,
          cityId,
          page: 1,
          limit: 200,
        });

        if (!alive) return;

        const flat = (data || []).map((p) => {
          const v = p?.vendors || {};
          return {
            ...p,
            vendorName: v?.company_name || p?.vendorName,
            vendorCity: v?.city || p?.vendorCity,
            vendorState: v?.state || p?.vendorState,
            vendorRating: v?.seller_rating || p?.vendorRating,
            vendorVerified: !!(
              v?.verification_badge ||
              v?.is_verified ||
              String(v?.kyc_status || '').toUpperCase() === 'APPROVED'
            ),
            price_unit: p?.price_unit,
            qty_unit: p?.qty_unit,
          };
        });

        setResults(flat);
      } catch (e) {
        console.error('ProductListing fetch error:', e);
        if (!alive) return;
        setResults([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    fetchData();
    return () => {
      alive = false;
    };
  }, [microSlug, stateSlug, districtSlug, citySlug]);

  const filtered = useMemo(() => {
    const list = Array.isArray(results) ? results : [];
    let out = list;

    const [minP, maxP] = Array.isArray(filters?.priceRange)
      ? filters.priceRange
      : [priceBounds.min, priceBounds.max];
    out = out.filter((p) => {
      const price = parsePriceOrNull(p?.price);
      if (price === null) return true;
      return price >= minP && price <= maxP;
    });

    if (filters.rating > 0) {
      out = out.filter((p) => {
        const r = numOrNull(p?.rating) ?? numOrNull(p?.vendorRating) ?? 0;
        return r >= filters.rating;
      });
    }

    if (filters.verified) out = out.filter((p) => !!p?.vendorVerified);

    return out;
  }, [results, filters, priceBounds.min, priceBounds.max]);

  const chipBase = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition';
  const chip = `${chipBase} bg-white text-slate-700 border-slate-200 hover:border-slate-300`;
  const chipActive = `${chipBase} bg-[#003D82] text-white border-[#003D82]`;

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content={pageKeywords} />
        {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        {pageSchema ? <script type="application/ld+json">{JSON.stringify(pageSchema)}</script> : null}
      </Helmet>

      <div className="bg-white border-b">
        <div className="w-[92vw] mx-auto py-6">
          {/* Chip breadcrumb row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/" className={chip}>
              <Home className="w-4 h-4" />
              IndianTradeMart
            </Link>
            <span className="text-slate-300">›</span>
            <Link to={`/directory/${headSlug}`} className={chip}>
              {headName}
            </Link>
            <span className="text-slate-300">›</span>
            <Link to={`/directory/${headSlug}/${subSlug}`} className={chip}>
              {subName}
            </Link>
            <span className="text-slate-300">›</span>
            <span className={chipActive}>{microName}</span>
          </div>

          {/* ✅ Search bar like Land Survey screenshot */}
          <div className="mt-4">
            <DirectorySearchBar
              initialService={microName}
              initialState={stateSlug}
              initialCity={citySlug}
              className="w-full"
              enableSuggestions
              compact
            />
          </div>

          {/* Title row */}
          <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
              {pageHeading}
            </h1>
            <div className="text-sm text-slate-500">{loading ? '' : `${filtered.length} found`}</div>
          </div>
        </div>
      </div>

      <div className="w-[92vw] mx-auto py-8">
        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3">
              <SearchFilters filters={filters} setFilters={setFilters} priceBounds={priceBounds} />
            </div>
            <div className="lg:col-span-9">
              <SearchResultsList products={filtered} query={microName} city={locationName} category={microSlug} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductListing;
