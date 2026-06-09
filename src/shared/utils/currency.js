export const DEFAULT_PLAN_CURRENCY = 'INR';

export const PLAN_CURRENCY_OPTIONS = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹', locale: 'en-IN', countryCodes: ['IN'] },
  { code: 'USD', label: 'US Dollar', symbol: '$', locale: 'en-US', countryCodes: ['US'] },
  { code: 'EUR', label: 'Euro', symbol: '€', locale: 'en-US', regionCodes: ['EU'] },
  { code: 'GBP', label: 'British Pound', symbol: '£', locale: 'en-GB', countryCodes: ['GB'] },
  { code: 'AED', label: 'UAE Dirham', symbol: 'AED ', locale: 'en-US', countryCodes: ['AE'] },
  { code: 'SAR', label: 'Saudi Riyal', symbol: 'SAR ', locale: 'en-US', countryCodes: ['SA'] },
  { code: 'QAR', label: 'Qatari Riyal', symbol: 'QAR ', locale: 'en-US', countryCodes: ['QA'] },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$', locale: 'en-US', countryCodes: ['SG'] },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$', locale: 'en-US', countryCodes: ['AU'] },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$', locale: 'en-US', countryCodes: ['CA'] },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥', locale: 'en-US', countryCodes: ['JP'] },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥', locale: 'en-US', countryCodes: ['CN'] },
  { code: 'BDT', label: 'Bangladeshi Taka', symbol: '৳', locale: 'en-US', countryCodes: ['BD'] },
  { code: 'NPR', label: 'Nepalese Rupee', symbol: 'NPR ', locale: 'en-US', countryCodes: ['NP'] },
];

export const PLAN_MARKET_REGION_OPTIONS = [
  {
    code: 'EU',
    label: 'European Union',
    countryCodes: [
      'AT',
      'BE',
      'BG',
      'HR',
      'CY',
      'CZ',
      'DK',
      'EE',
      'FI',
      'FR',
      'DE',
      'GR',
      'HU',
      'IE',
      'IT',
      'LV',
      'LT',
      'LU',
      'MT',
      'NL',
      'PL',
      'PT',
      'RO',
      'SK',
      'SI',
      'ES',
      'SE',
    ],
  },
  { code: 'GCC', label: 'Gulf Cooperation Council', countryCodes: ['AE', 'BH', 'KW', 'OM', 'QA', 'SA'] },
  { code: 'NORTH_AMERICA', label: 'North America', countryCodes: ['US', 'CA'] },
  { code: 'APAC', label: 'Asia Pacific', countryCodes: ['AU', 'BD', 'CN', 'IN', 'JP', 'NP', 'SG'] },
  { code: 'MENA', label: 'Middle East & North Africa', countryCodes: ['AE', 'BH', 'EG', 'KW', 'OM', 'QA', 'SA'] },
];

const PLAN_CURRENCY_MAP = PLAN_CURRENCY_OPTIONS.reduce((acc, currency) => {
  acc[currency.code] = currency;
  return acc;
}, {});

const PLAN_REGION_MAP = PLAN_MARKET_REGION_OPTIONS.reduce((acc, region) => {
  acc[region.code] = region;
  return acc;
}, {});

export const normalizePlanCurrency = (value) => {
  const code = String(value || '').trim().toUpperCase();
  return PLAN_CURRENCY_MAP[code] ? code : DEFAULT_PLAN_CURRENCY;
};

export const getPlanCurrencyMeta = (value) => {
  const code = normalizePlanCurrency(value);
  return PLAN_CURRENCY_MAP[code] || PLAN_CURRENCY_MAP[DEFAULT_PLAN_CURRENCY];
};

export const formatPlanMoney = (value, currency = DEFAULT_PLAN_CURRENCY) => {
  const meta = getPlanCurrencyMeta(currency);
  const amount = Number(value || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const maximumFractionDigits = Number.isInteger(safeAmount) ? 0 : 2;
  const formatted = safeAmount.toLocaleString(meta.locale || 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
  return `${meta.symbol}${formatted}`;
};

export const normalizeCountryCode = (value) => {
  const code = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return code.length === 2 ? code : '';
};

export const normalizeRegionCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);

export const getRegionCodesForCountry = (countryCode) => {
  const country = normalizeCountryCode(countryCode);
  if (!country) return [];
  return PLAN_MARKET_REGION_OPTIONS.filter((region) =>
    (region.countryCodes || []).includes(country)
  ).map((region) => region.code);
};

export const splitPlanMarketCodes = (value) => {
  const parts = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((part) => part.trim());
  const countryCodes = [];
  const regionCodes = [];

  parts.forEach((part) => {
    const region = normalizeRegionCode(part);
    if (!region) return;
    if (PLAN_REGION_MAP[region]) {
      regionCodes.push(region);
      return;
    }
    const country = normalizeCountryCode(region);
    if (country) {
      countryCodes.push(country);
      return;
    }
    regionCodes.push(region);
  });

  return {
    countryCodes: Array.from(new Set(countryCodes)),
    regionCodes: Array.from(new Set(regionCodes)),
  };
};

export const normalizeRegionalPrices = (value) => {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((row) => {
      const explicitCountries = Array.isArray(row?.country_codes)
        ? row.country_codes
        : row?.country_codes || row?.countries || '';
      const explicitRegions = Array.isArray(row?.region_codes)
        ? row.region_codes
        : row?.region_codes || row?.regions || '';
      const marketCodes = row?.market_codes || row?.markets || '';
      const splitExplicit = {
        countryCodes: [
          ...splitPlanMarketCodes(explicitCountries).countryCodes,
          ...splitPlanMarketCodes(marketCodes).countryCodes,
        ],
        regionCodes: [
          ...splitPlanMarketCodes(explicitRegions).regionCodes,
          ...splitPlanMarketCodes(marketCodes).regionCodes,
        ],
      };

      const currency = normalizePlanCurrency(row?.currency);
      const priceRaw = Number(row?.price ?? row?.current_price ?? 0);
      const originalPriceRaw = Number(row?.original_price ?? 0);
      const discountRaw = Number(row?.discount_percent ?? 0);
      const extraLeadRaw = Number(row?.extra_lead_price ?? 0);

      return {
        currency,
        country_codes: Array.from(new Set(splitExplicit.countryCodes)),
        region_codes: Array.from(new Set(splitExplicit.regionCodes)),
        price: Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : 0,
        original_price: Number.isFinite(originalPriceRaw) && originalPriceRaw >= 0 ? originalPriceRaw : 0,
        discount_percent: Number.isFinite(discountRaw) ? Math.max(0, Math.min(100, discountRaw)) : 0,
        discount_label: String(row?.discount_label || '').trim(),
        extra_lead_price: Number.isFinite(extraLeadRaw) && extraLeadRaw >= 0 ? extraLeadRaw : 0,
      };
    })
    .filter((row) => row.currency !== DEFAULT_PLAN_CURRENCY && row.price > 0);
};

const getCurrencyDefaultCountryCodes = (currency) =>
  getPlanCurrencyMeta(currency).countryCodes || [];

const getCurrencyDefaultRegionCodes = (currency) =>
  getPlanCurrencyMeta(currency).regionCodes || [];

export const regionalPriceMatchesMarket = (priceRow, market = {}) => {
  const row = normalizeRegionalPrices([priceRow])[0];
  if (!row) return false;

  const country = normalizeCountryCode(market.countryCode);
  const regionCodes = new Set((market.regionCodes || []).map(normalizeRegionCode).filter(Boolean));
  const rowCountries = row.country_codes.length
    ? row.country_codes
    : getCurrencyDefaultCountryCodes(row.currency);
  const rowRegions = row.region_codes.length
    ? row.region_codes
    : getCurrencyDefaultRegionCodes(row.currency);

  if (country && rowCountries.includes(country)) return true;
  if (rowRegions.some((region) => regionCodes.has(region))) return true;

  return rowRegions.some((region) =>
    (PLAN_REGION_MAP[region]?.countryCodes || []).includes(country)
  );
};

export const pickRegionalPriceForMarket = (regionalPrices, market = {}) =>
  normalizeRegionalPrices(regionalPrices).find((priceRow) =>
    regionalPriceMatchesMarket(priceRow, market)
  ) || null;

const TIMEZONE_COUNTRY_MAP = {
  'Asia/Calcutta': 'IN',
  'Asia/Kolkata': 'IN',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Qatar': 'QA',
  'Asia/Singapore': 'SG',
  'Asia/Tokyo': 'JP',
  'Asia/Shanghai': 'CN',
  'Asia/Dhaka': 'BD',
  'Asia/Kathmandu': 'NP',
  'Australia/Sydney': 'AU',
};

const getCountryFromLanguage = (language) => {
  const match = String(language || '').match(/[-_]([A-Za-z]{2})$/);
  return normalizeCountryCode(match?.[1]);
};

export const getVisitorMarketContext = () => {
  if (typeof window === 'undefined') {
    return { countryCode: 'IN', regionCodes: getRegionCodesForCountry('IN'), source: 'fallback' };
  }

  const params = new URLSearchParams(window.location.search || '');
  const queryCountry = normalizeCountryCode(
    params.get('country') || params.get('country_code') || params.get('market_country')
  );
  const storedCountry = normalizeCountryCode(window.localStorage?.getItem('itm_country_code'));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneCountry = normalizeCountryCode(TIMEZONE_COUNTRY_MAP[timezone]);
  const languageCountry = normalizeCountryCode(
    (navigator.languages || []).map(getCountryFromLanguage).find(Boolean) ||
      getCountryFromLanguage(navigator.language)
  );

  const countryCode = queryCountry || storedCountry || timezoneCountry || languageCountry || 'IN';
  const source = queryCountry
    ? 'query'
    : storedCountry
      ? 'stored'
      : timezoneCountry
        ? 'timezone'
        : languageCountry
          ? 'locale'
          : 'fallback';

  return {
    countryCode,
    regionCodes: getRegionCodesForCountry(countryCode),
    source,
  };
};
