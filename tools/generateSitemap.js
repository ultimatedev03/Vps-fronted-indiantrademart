import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { db, FRONTEND_DIR } from './mysqlToolClient.js';

dotenv.config({ path: path.join(FRONTEND_DIR, '.env.local') });
dotenv.config({ path: '.env.local' });

const BASE_URL = String(process.env.VITE_SITE_URL || 'https://indiantrademart.com').trim().replace(/\/+$/, '');
const PUBLIC_DIR = path.join(FRONTEND_DIR, 'public');
const DEFAULT_SITEMAP_URL_LIMIT = 5000;
const parseSitemapLimit = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SITEMAP_URL_LIMIT;
  return Math.min(50000, Math.max(1000, parsed));
};
const SITEMAP_URL_LIMIT = parseSitemapLimit(process.env.SITEMAP_URL_LIMIT);
const INDEX_LASTMOD = String(process.env.SITEMAP_INDEX_LASTMOD || '').trim();

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const xmlFooter = '</urlset>';

const escapeXml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const encodeSegment = (value = '') => encodeURIComponent(String(value || '').trim());

const isMissingColumnError = (err) => {
  if (!err) return false;
  return err.code === '42703' || err.code === 'ER_BAD_FIELD_ERROR' || /column .*does not exist|unknown column/i.test(err.message || '');
};

const toBool = (value) => value === true || value === 1 || String(value).trim() === '1' || String(value).toLowerCase() === 'true';
const normalizeKey = (value = '') => String(value || '').trim();
const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value.map(normalizeKey).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(normalizeKey).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const parseJsonObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const normalizeCoverage = (value = {}) => {
  const raw = parseJsonObject(value);
  return {
    states: parseJsonArray(raw.states),
    districts: parseJsonArray(raw.districts),
    cities: parseJsonArray(raw.cities),
  };
};

const isInactiveStatus = (value) => {
  const status = String(value || '').trim().toUpperCase();
  return ['SUSPENDED', 'TERMINATED', 'DELETED', 'REJECTED', 'BLOCKED', 'INACTIVE'].includes(status);
};

const isPublicProduct = (product = {}) => {
  const status = String(product.status || '').trim().toUpperCase();
  if (!status) return true;
  return ['ACTIVE', 'PUBLISHED', 'APPROVED', 'LIVE'].includes(status);
};

const isOnboardedVendor = (vendor = {}) => {
  if (isInactiveStatus(vendor.status) || isInactiveStatus(vendor.account_status)) return false;
  return toBool(vendor.is_active) || toBool(vendor.is_verified) || ['VERIFIED', 'ACTIVE', 'ONBOARDED'].includes(String(vendor.status || '').trim().toUpperCase());
};

const isActiveCategory = (row = {}) => row && (row.is_active === undefined || toBool(row.is_active));

const getCurrentDate = () => new Date().toISOString().split('T')[0];

const toDateOnly = (value) => {
  if (!value) return getCurrentDate();
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0] || getCurrentDate();
};

const createUrlEntry = (location, lastmod, priority = '0.7', changefreq = 'weekly') => ({
  location,
  lastmod: toDateOnly(lastmod),
  priority,
  changefreq,
});

const renderUrlEntry = (entry) => `  <url>
    <loc>${escapeXml(entry.location)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
    <priority>${escapeXml(entry.priority)}</priority>
    <changefreq>${escapeXml(entry.changefreq)}</changefreq>
  </url>`;

const stripTrailingLineSpaces = (content = '') => String(content).replace(/[ \t]+$/gm, '');

const renderSitemap = (entries = []) => stripTrailingLineSpaces(`${xmlHeader}\n${entries.map(renderUrlEntry).join('\n')}\n${xmlFooter}`);

const writeSitemapFile = (filename, content) => {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DIR, filename), stripTrailingLineSpaces(content));
  console.log(`✅ Created ${filename}`);
};

const cleanupGeneratedSitemaps = () => {
  if (!fs.existsSync(PUBLIC_DIR)) return;
  const generatedSitemapPattern = /^sitemap(?:-(?:static|products|vendors|categories|locations)(?:-\d+)?)?\.xml$/i;
  fs.readdirSync(PUBLIC_DIR)
    .filter((filename) => generatedSitemapPattern.test(filename))
    .forEach((filename) => {
      fs.rmSync(path.join(PUBLIC_DIR, filename), { force: true });
    });
};

const writeSitemapChunks = (baseName, entries = []) => {
  const safeEntries = entries.filter((entry) => entry?.location);
  if (safeEntries.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < safeEntries.length; i += SITEMAP_URL_LIMIT) {
    chunks.push(safeEntries.slice(i, i + SITEMAP_URL_LIMIT));
  }

  return chunks.map((chunk, index) => {
    const filename =
      index === 0
        ? baseName
        : baseName.replace(/\.xml$/i, `-${index + 1}.xml`);
    writeSitemapFile(filename, renderSitemap(chunk));
    return {
      name: filename,
      lastmod: INDEX_LASTMOD || chunk.reduce((latest, entry) => (entry.lastmod > latest ? entry.lastmod : latest), chunk[0]?.lastmod || getCurrentDate()),
    };
  });
};

const selectAll = async (table, columns, options = {}) => {
  let query = db.from(table).select(columns);
  if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending !== false });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

const safeSelectAll = async (table, columnSets, options = {}) => {
  let lastError = null;
  for (const columns of columnSets) {
    try {
      return await selectAll(table, columns, options);
    } catch (error) {
      lastError = error;
      if (!isMissingColumnError(error)) throw error;
    }
  }
  throw lastError || new Error(`Failed to read ${table}`);
};

const dedupeEntries = (entries = []) => {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = entry?.location;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const addNormalizedKeys = (target, values = []) => {
  values.map(normalizeKey).filter(Boolean).forEach((key) => target.add(key));
};

const getVendorKeys = (vendor = {}) =>
  [vendor.id, vendor.vendor_id].map(normalizeKey).filter(Boolean);

const loadPublicContent = async () => {
  const [products, vendors] = await Promise.all([
    safeSelectAll(
      'products',
      [
        'id, slug, vendor_id, micro_category_id, target_locations, updated_at, created_at, status',
        'id, slug, vendor_id, micro_category_id, created_at, status',
        'id, slug, vendor_id, target_locations, updated_at, created_at, status',
        'id, slug, vendor_id, created_at, status',
        'id, slug, created_at',
      ],
      { orderBy: 'created_at', ascending: false }
    ),
    safeSelectAll(
      'vendors',
      [
        'id, vendor_id, slug, state_id, district_id, city_id, updated_at, created_at, status, account_status, is_active, is_verified',
        'id, vendor_id, slug, state_id, city_id, created_at, status, is_active',
        'id, vendor_id, slug, state_id, city_id, created_at',
      ],
      { orderBy: 'created_at', ascending: false }
    ).catch((error) => {
      console.warn('⚠️  Unable to filter public content by vendor status:', error?.message || error);
      return [];
    }),
  ]);

  const preferenceRows = await safeSelectAll(
    'vendor_preferences',
    [
      'vendor_id, preferred_states, preferred_districts, preferred_cities, updated_at',
      'vendor_id, preferred_states, preferred_cities, updated_at',
      'vendor_id',
    ]
  ).catch((error) => {
    console.warn('⚠️  Unable to load vendor preferences for sitemap coverage:', error?.message || error);
    return [];
  });

  const publicVendorKeys = new Set();
  const vendorByKey = new Map();
  const vendorLocationByKey = new Map();
  const publicVendors = vendors.filter(isOnboardedVendor);

  publicVendors.forEach((vendor) => {
    const keys = getVendorKeys(vendor);
    addNormalizedKeys(publicVendorKeys, keys);
    keys.forEach((key) => vendorByKey.set(key, vendor));
    if (vendor.state_id || vendor.city_id) {
      keys.forEach((key) => {
        vendorLocationByKey.set(key, {
          stateId: vendor.state_id,
          districtId: vendor.district_id,
          cityId: vendor.city_id,
          lastmod: vendor.updated_at || vendor.created_at,
          preferences: { states: [], districts: [], cities: [] },
        });
      });
    }
  });

  preferenceRows.forEach((pref) => {
    const vendor = vendorByKey.get(normalizeKey(pref.vendor_id));
    const keys = vendor ? getVendorKeys(vendor) : [normalizeKey(pref.vendor_id)].filter(Boolean);
    const preferences = {
      states: parseJsonArray(pref.preferred_states),
      districts: parseJsonArray(pref.preferred_districts),
      cities: parseJsonArray(pref.preferred_cities),
    };
    keys.forEach((key) => {
      const current = vendorLocationByKey.get(key) || {
        stateId: vendor?.state_id || null,
        districtId: vendor?.district_id || null,
        cityId: vendor?.city_id || null,
        lastmod: pref.updated_at || vendor?.updated_at || vendor?.created_at,
        preferences: { states: [], districts: [], cities: [] },
      };
      vendorLocationByKey.set(key, {
        ...current,
        preferences,
        lastmod: pref.updated_at || current.lastmod,
      });
    });
  });

  const publicProducts = products
    .filter(isPublicProduct)
    .filter((product) => {
      const vendorKey = normalizeKey(product.vendor_id);
      return Boolean(vendorKey) && publicVendorKeys.has(vendorKey);
    });

  return {
    publicProducts,
    publicVendors,
    publicVendorKeys,
    vendorLocationByKey,
  };
};

const generateProductsSitemap = async (content) => {
  console.log('📦 Generating products sitemap...');
  const entries = content.publicProducts
    .map((product) => {
      const slugOrId = String(product.slug || product.id || '').trim();
      if (!slugOrId) return null;
      return createUrlEntry(`${BASE_URL}/product/${encodeSegment(slugOrId)}`, product.updated_at || product.created_at, '0.8', 'weekly');
    })
    .filter(Boolean);

  return dedupeEntries(entries);
};

const generateVendorsSitemap = async (content) => {
  console.log('🏢 Generating vendors sitemap...');
  const entries = content.publicVendors
    .map((vendor) => {
      const slugOrId = String(vendor.slug || vendor.vendor_id || vendor.id || '').trim();
      if (!slugOrId) return null;
      return createUrlEntry(`${BASE_URL}/directory/vendor/${encodeSegment(slugOrId)}`, vendor.updated_at || vendor.created_at, '0.8', 'weekly');
    })
    .filter(Boolean);

  return dedupeEntries(entries);
};

const loadCategoryModel = async () => {
  const [headsRaw, subsRaw, microsRaw] = await Promise.all([
    safeSelectAll('head_categories', ['id, name, slug, is_active, updated_at, created_at', 'id, name, slug, updated_at, created_at'], { orderBy: 'created_at', ascending: false }),
    safeSelectAll('sub_categories', ['id, head_category_id, name, slug, is_active, updated_at, created_at', 'id, head_category_id, name, slug, updated_at, created_at'], { orderBy: 'created_at', ascending: false }),
    safeSelectAll('micro_categories', ['id, sub_category_id, name, slug, is_active, updated_at, created_at', 'id, sub_category_id, name, slug, updated_at, created_at'], { orderBy: 'created_at', ascending: false }),
  ]);

  const heads = headsRaw.filter(isActiveCategory);
  const subs = subsRaw.filter(isActiveCategory);
  const micros = microsRaw.filter(isActiveCategory);

  const headById = new Map(heads.map((head) => [String(head.id), head]));
  const subById = new Map(subs.map((sub) => [String(sub.id), sub]));

  const activeSubs = subs.filter((sub) => headById.has(String(sub.head_category_id)));
  const activeMicros = micros.filter((micro) => {
    const sub = subById.get(String(micro.sub_category_id));
    return sub && headById.has(String(sub.head_category_id));
  });

  return {
    heads,
    subs: activeSubs,
    micros: activeMicros,
    headById,
    subById,
  };
};

const generateCategoriesSitemap = async (model, content) => {
  console.log('📂 Generating category sitemap...');
  const entries = [];
  const linkedSubIds = new Set();
  const linkedHeadIds = new Set();

  model.micros.forEach((micro) => {
    const sub = model.subById.get(String(micro.sub_category_id));
    const head = model.headById.get(String(sub?.head_category_id));
    if (!sub?.slug || !head?.slug || !micro.slug) return;

    linkedSubIds.add(normalizeKey(sub.id));
    linkedHeadIds.add(normalizeKey(head.id));
  });

  model.heads.forEach((head) => {
    if (!head.slug || !linkedHeadIds.has(normalizeKey(head.id))) return;
    entries.push(createUrlEntry(`${BASE_URL}/directory/${encodeSegment(head.slug)}`, head.updated_at || head.created_at, '0.7', 'weekly'));
  });

  model.subs.forEach((sub) => {
    const head = model.headById.get(String(sub.head_category_id));
    if (!head?.slug || !sub.slug || !linkedSubIds.has(normalizeKey(sub.id))) return;
    entries.push(createUrlEntry(`${BASE_URL}/directory/${encodeSegment(head.slug)}/${encodeSegment(sub.slug)}`, sub.updated_at || sub.created_at, '0.7', 'weekly'));
  });

  model.micros.forEach((micro) => {
    const sub = model.subById.get(String(micro.sub_category_id));
    const head = model.headById.get(String(sub?.head_category_id));
    if (!head?.slug || !sub?.slug || !micro.slug) return;
    entries.push(createUrlEntry(`${BASE_URL}/directory/${encodeSegment(head.slug)}/${encodeSegment(sub.slug)}/${encodeSegment(micro.slug)}`, micro.updated_at || micro.created_at, '0.7', 'weekly'));
  });

  return dedupeEntries(entries);
};

const generateLocationsSitemap = async (model, content) => {
  console.log('📍 Generating location sitemap...');
  const [statesRaw, districtsRaw, citiesRaw] = await Promise.all([
    safeSelectAll('states', ['id, name, slug, is_active, updated_at, created_at', 'id, name, slug, updated_at, created_at'], { orderBy: 'name', ascending: true }),
    safeSelectAll('districts', ['id, state_id, name, slug, is_active, updated_at, created_at', 'id, state_id, name, slug, updated_at, created_at'], { orderBy: 'name', ascending: true }).catch(() => []),
    safeSelectAll('cities', ['id, state_id, district_id, name, slug, is_active, updated_at, created_at', 'id, state_id, name, slug, updated_at, created_at'], { orderBy: 'name', ascending: true }),
  ]);

  const states = statesRaw.filter(isActiveCategory);
  const districts = districtsRaw.filter(isActiveCategory);
  const cities = citiesRaw.filter(isActiveCategory);
  const stateById = new Map(states.map((state) => [String(state.id), state]));
  const districtById = new Map(districts.map((district) => [String(district.id), district]));
  const cityById = new Map(cities.map((city) => [String(city.id), city]));
  const publicCityIds = new Set();
  const microById = new Map(model.micros.map((micro) => [String(micro.id), micro]));
  const entries = [];

  const categoryPath = (head, sub, micro, state, district = null, city = null) => {
    let path = `${BASE_URL}/directory/${encodeSegment(head.slug)}/${encodeSegment(sub.slug)}/${encodeSegment(micro.slug)}/${encodeSegment(state.slug)}`;
    if (district?.slug) path += `/${encodeSegment(district.slug)}`;
    if (city?.slug) path += `/${encodeSegment(city.slug)}`;
    return path;
  };

  const addCategoryLocation = ({ head, sub, micro, state, district = null, city = null, lastmod }) => {
    if (!head?.slug || !sub?.slug || !micro?.slug || !state?.slug) return;
    entries.push(createUrlEntry(categoryPath(head, sub, micro, state, district, city), lastmod, city ? '0.65' : district ? '0.62' : '0.6', 'monthly'));
  };

  content.publicProducts.forEach((product) => {
    const micro = microById.get(String(product.micro_category_id || ''));
    const vendorLocation = content.vendorLocationByKey.get(normalizeKey(product.vendor_id));
    if (!micro || !vendorLocation) return;

    const sub = model.subById.get(String(micro.sub_category_id));
    const head = model.headById.get(String(sub?.head_category_id));
    if (!head?.slug || !sub?.slug || !micro.slug) return;
    const lastmod = product.updated_at || product.created_at || vendorLocation.lastmod;
    const productCoverage = normalizeCoverage(product.target_locations);
    const preferences = vendorLocation.preferences || {};

    const stateIds = productCoverage.states.length
      ? productCoverage.states
      : (preferences.states?.length ? preferences.states : [vendorLocation.stateId].map(normalizeKey).filter(Boolean));
    const districtIds = productCoverage.districts.length
      ? productCoverage.districts
      : (preferences.districts?.length ? preferences.districts : [vendorLocation.districtId].map(normalizeKey).filter(Boolean));
    const cityIds = productCoverage.cities.length
      ? productCoverage.cities
      : (preferences.cities?.length ? preferences.cities : [vendorLocation.cityId].map(normalizeKey).filter(Boolean));

    stateIds.forEach((stateId) => {
      const state = stateById.get(String(stateId));
      if (state) addCategoryLocation({ head, sub, micro, state, lastmod });
    });

    districtIds.forEach((districtId) => {
      const district = districtById.get(String(districtId));
      const state = stateById.get(String(district?.state_id || ''));
      if (state && district) addCategoryLocation({ head, sub, micro, state, district, lastmod });
    });

    cityIds.forEach((cityId) => {
      const city = cityById.get(String(cityId));
      if (!city?.slug) return;
      publicCityIds.add(normalizeKey(city.id));
      const state = stateById.get(String(city.state_id || ''));
      const district = districtById.get(String(city.district_id || ''));
      if (!state) return;
      addCategoryLocation({ head, sub, micro, state, district, city, lastmod });
      if (district) addCategoryLocation({ head, sub, micro, state, district, lastmod });
      addCategoryLocation({ head, sub, micro, state, lastmod });
    });
  });

  cities.forEach((city) => {
    if (city.slug && publicCityIds.has(normalizeKey(city.id))) {
      entries.push(createUrlEntry(`${BASE_URL}/directory/city/${encodeSegment(city.slug)}`, city.updated_at || city.created_at, '0.6', 'monthly'));
    }
  });

  return dedupeEntries(entries);
};

const generateSitemapIndex = (sitemaps) => {
  const header = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const footer = '</sitemapindex>';
  const entries = sitemaps.map((sitemap) => `  <sitemap>
    <loc>${escapeXml(`${BASE_URL}/${sitemap.name}`)}</loc>
    <lastmod>${escapeXml(sitemap.lastmod || INDEX_LASTMOD || getCurrentDate())}</lastmod>
  </sitemap>`);
  return `${header}\n${entries.join('\n')}\n${footer}`;
};

const generateAllSitemaps = async () => {
  console.log('🤖 Starting dynamic sitemap generation...');
  cleanupGeneratedSitemaps();
  const model = await loadCategoryModel();
  const content = await loadPublicContent();

  const generated = [];

  const sitemapJobs = [
    { name: 'sitemap-products.xml', generator: () => generateProductsSitemap(content) },
    { name: 'sitemap-vendors.xml', generator: () => generateVendorsSitemap(content) },
    { name: 'sitemap-categories.xml', generator: () => generateCategoriesSitemap(model, content) },
    { name: 'sitemap-locations.xml', generator: () => generateLocationsSitemap(model, content) },
  ];

  for (const sitemap of sitemapJobs) {
    try {
      const entries = await sitemap.generator();
      const chunks = writeSitemapChunks(sitemap.name, entries);
      if (chunks.length) generated.push(...chunks);
      else console.warn(`⚠️  Skipping empty sitemap: ${sitemap.name}`);
    } catch (err) {
      console.error(`Error generating ${sitemap.name}:`, err);
    }
  }

  if (generated.length > 0) {
    writeSitemapFile('sitemap.xml', generateSitemapIndex(generated));
    console.log('✅ Created sitemap index file: sitemap.xml');
  }

  console.log(`✨ Sitemap generation complete! (${generated.length} sitemap files indexed)`);
  generated.forEach((sitemap) => console.log(`   Sitemap: ${BASE_URL}/${sitemap.name}`));
};

generateAllSitemaps()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.close());
