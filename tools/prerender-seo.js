import { createClient } from '@supabase/supabase-js';
import { setDefaultResultOrder } from 'dns';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const FRONTEND_DIR = process.env.FRONTEND_DIR || 'frontend';
dotenv.config({ path: path.join(process.cwd(), FRONTEND_DIR, '.env.local') });
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const BASE_URL = process.env.VITE_SITE_URL || 'https://indiantrademart.com';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const distDir = path.join(process.cwd(), FRONTEND_DIR, 'dist');
const templatePath = path.join(distDir, 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error('Missing dist/index.html. Run `vite build` first.');
  process.exit(1);
}

const templateHtml = fs.readFileSync(templatePath, 'utf8');

try {
  // Helps in environments where IPv6 handshake intermittently fails.
  setDefaultResultOrder('ipv4first');
} catch {
  // ignore for older runtimes
}

const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);
const MAX_FETCH_RETRIES = Math.max(1, Number(process.env.SUPABASE_FETCH_RETRIES || 3));
const FETCH_RETRY_DELAY_MS = Math.max(50, Number(process.env.SUPABASE_FETCH_RETRY_DELAY_MS || 250));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableNetworkError = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED'].includes(code)) {
    return true;
  }
  return (
    message.includes('fetch failed') ||
    message.includes('socket hang up') ||
    message.includes('network error') ||
    message.includes('tls') ||
    message.includes('ssl') ||
    message.includes('handshake') ||
    message.includes('terminated')
  );
};

const resilientFetch = async (input, init) => {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!RETRYABLE_HTTP_STATUS.has(response.status) || attempt >= MAX_FETCH_RETRIES) {
        return response;
      }
      try {
        response.body?.cancel?.();
      } catch {
        // no-op
      }
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || attempt >= MAX_FETCH_RETRIES) throw error;
    }

    await sleep(FETCH_RETRY_DELAY_MS * attempt);
  }
  throw lastError || new Error('Supabase fetch failed');
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: resilientFetch,
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const isMissingColumnError = (err) => {
  if (!err) return false;
  return err.code === '42703' || /column .* does not exist/i.test(err.message || '');
};

const isTransientSupabaseError = (err) => {
  const blob = String(
    [err?.message, err?.details, err?.hint, err?.code].filter(Boolean).join(' ')
  ).toLowerCase();
  return (
    blob.includes('terminated') ||
    blob.includes('fetch failed') ||
    blob.includes('network') ||
    blob.includes('ssl') ||
    blob.includes('tls') ||
    blob.includes('handshake') ||
    blob.includes('timed out') ||
    blob.includes('timeout') ||
    blob.includes('socket')
  );
};

const withSupabaseRetry = async (label, runner, maxAttempts = Math.max(2, MAX_FETCH_RETRIES)) => {
  let lastRes = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await runner();
    lastRes = res;
    if (!res?.error) return res;
    if (!isTransientSupabaseError(res.error) || attempt >= maxAttempts) return res;
    await sleep(FETCH_RETRY_DELAY_MS * attempt);
  }
  return lastRes;
};

const escapeHtml = (value) =>
  String(value || '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return ch;
    }
  });

const setTitle = (html, title) => {
  if (!title) return html;
  const safeTitle = `<title>${escapeHtml(title)}</title>`;
  if (/<title>.*<\/title>/i.test(html)) {
    return html.replace(/<title>.*<\/title>/i, safeTitle);
  }
  return html.replace('</head>', `  ${safeTitle}\n</head>`);
};

const upsertMeta = (html, name, content) => {
  if (!content) return html;
  const safe = escapeHtml(content);
  const tag = `<meta name="${name}" content="${safe}">`;
  const re = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i');
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `  ${tag}\n</head>`);
};

const upsertCanonical = (html, href) => {
  if (!href) return html;
  const safe = escapeHtml(href);
  const tag = `<link rel="canonical" href="${safe}">`;
  const re = /<link\s+rel=["']canonical["'][^>]*>/i;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `  ${tag}\n</head>`);
};

const applyMeta = (html, meta = {}) => {
  let out = html;
  out = setTitle(out, meta.title);
  out = upsertMeta(out, 'description', meta.description);
  out = upsertMeta(out, 'keywords', meta.keywords);
  out = upsertCanonical(out, meta.canonical);
  return out;
};

const PUBLIC_FALLBACK_STYLE_BLOCK = `
<style data-prerender-public="true">
  .itm-public-fallback {
    min-height: 100vh;
    background:
      radial-gradient(circle at top right, rgba(59, 130, 246, 0.18), transparent 22rem),
      linear-gradient(180deg, #e2e8f0 0%, #f8fafc 18rem);
  }

  .itm-public-fallback-nav,
  .itm-public-fallback-main {
    max-width: 1120px;
    margin: 0 auto;
    padding-left: 16px;
    padding-right: 16px;
  }

  .itm-public-fallback-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-top: 20px;
    padding-bottom: 20px;
  }

  .itm-public-fallback-brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    font-weight: 700;
    text-decoration: none;
    color: #0f172a;
  }

  .itm-public-fallback-nav-links {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
  }

  .itm-public-fallback-nav-links a,
  .itm-public-fallback-actions a {
    color: #334155;
    text-decoration: none;
    font-size: 14px;
  }

  .itm-public-fallback-main {
    padding-top: 40px;
    padding-bottom: 64px;
  }

  .itm-public-fallback-hero {
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 32px;
    padding: 32px;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
  }

  .itm-public-fallback-hero h1 {
    margin: 0;
    max-width: 880px;
    font-size: clamp(2rem, 5vw, 3.6rem);
    line-height: 1.05;
  }

  .itm-public-fallback-hero p {
    max-width: 760px;
    margin: 20px 0 0;
    font-size: 18px;
    line-height: 1.7;
    color: #475569;
  }

  .itm-public-fallback-actions,
  .itm-public-fallback-links {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .itm-public-fallback-actions {
    margin-top: 28px;
  }

  .itm-public-fallback-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 12px 18px;
    background: #0f172a;
    color: #fff !important;
    text-decoration: none;
    font-weight: 700;
  }

  .itm-public-fallback-button-secondary {
    background: #fff;
    color: #0f172a !important;
    border: 1px solid #cbd5e1;
  }

  .itm-public-fallback-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-top: 24px;
  }

  .itm-public-fallback-card {
    border-radius: 24px;
    background: #fff;
    border: 1px solid #e2e8f0;
    padding: 20px;
  }

  .itm-public-fallback-card h2 {
    margin: 0 0 12px;
    font-size: 20px;
  }

  .itm-public-fallback-card p,
  .itm-public-fallback-card li {
    color: #475569;
    line-height: 1.6;
    font-size: 14px;
  }

  .itm-public-fallback-card ul {
    margin: 0;
    padding-left: 18px;
  }

  .itm-public-fallback-links {
    margin-top: 12px;
  }

  @media (max-width: 860px) {
    .itm-public-fallback-grid {
      grid-template-columns: 1fr;
    }

    .itm-public-fallback-nav {
      flex-direction: column;
      align-items: flex-start;
    }

    .itm-public-fallback-hero {
      padding: 24px;
    }
  }
</style>
`;

const PUBLIC_FALLBACK_ROOT_HTML = `
<div class="itm-public-fallback">
  <header class="itm-public-fallback-nav">
    <a class="itm-public-fallback-brand" href="/">
      <img src="/itm-logo.png" alt="Indian Trade Mart" width="44" height="44" />
      <span>Indian Trade Mart</span>
    </a>
    <nav class="itm-public-fallback-nav-links" aria-label="Primary">
      <a href="/directory">Directory</a>
      <a href="/directory/vendor">Suppliers</a>
      <a href="https://blog.indiantrademart.com">Blog</a>
      <a href="/about-us">About Us</a>
      <a href="/contact">Contact</a>
    </nav>
  </header>

  <main class="itm-public-fallback-main">
    <section class="itm-public-fallback-hero">
      <h1>Connect with verified manufacturers, suppliers and B2B service providers across India.</h1>
      <p>
        Indian Trade Mart is a B2B marketplace for supplier discovery, product sourcing, and business growth across
        categories, cities, and industries.
      </p>
      <div class="itm-public-fallback-actions">
        <a class="itm-public-fallback-button" href="/directory">Browse directory</a>
        <a class="itm-public-fallback-button itm-public-fallback-button-secondary" href="/directory/vendor">Find suppliers</a>
      </div>
    </section>

    <section class="itm-public-fallback-grid" aria-label="Marketplace overview">
      <article class="itm-public-fallback-card">
        <h2>Popular destinations</h2>
        <div class="itm-public-fallback-links">
          <a href="/directory/cities">Top cities</a>
          <a href="/directory/vendor">Featured suppliers</a>
          <a href="/products">Products</a>
        </div>
      </article>
      <article class="itm-public-fallback-card">
        <h2>Marketplace content</h2>
        <ul>
          <li>B2B supplier discovery across categories and cities</li>
          <li>Vendor visibility, lead workflows, and buyer enquiries</li>
          <li>Insights, legal pages, and support routes available without JavaScript</li>
        </ul>
      </article>
      <article class="itm-public-fallback-card">
        <h2>Quick links</h2>
        <div class="itm-public-fallback-links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Use</a>
          <a href="https://blog.indiantrademart.com">Blog &amp; Insights</a>
        </div>
      </article>
    </section>
  </main>
</div>
`;

const injectPublicFallback = (html) => {
  let out = html;
  if (!out.includes('data-prerender-public="true"')) {
    out = out.replace('</head>', `  ${PUBLIC_FALLBACK_STYLE_BLOCK}\n</head>`);
  }

  return out.replace(
    /<div id="root">[\s\S]*?<\/div>\s*<\/body>/i,
    `<div id="root">${PUBLIC_FALLBACK_ROOT_HTML}</div>\n  </body>`
  );
};

const writeRoute = (route, meta, { includePublicFallback = true } = {}) => {
  const cleaned = String(route || '/').trim();
  const isRoot = cleaned === '/' || cleaned === '';
  const targetDir = isRoot
    ? distDir
    : path.join(distDir, cleaned.replace(/^\/+/, '').replace(/\/+$/, ''));

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const outPath = path.join(targetDir, 'index.html');
  const withMeta = applyMeta(templateHtml, meta);
  const shouldInjectPublicFallback = includePublicFallback && !isRoot;
  const finalHtml = shouldInjectPublicFallback ? injectPublicFallback(withMeta) : withMeta;
  fs.writeFileSync(outPath, finalHtml);
};

const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

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

const HOME_SEO = {
  title:
    "Indian Trade Mart- India's leading online B2B marketplace and platform for Indian Manufacturers, Suppliers, Exporters, Service provider, Directory.",
  description:
    "indiantrademart.com is  single window & India's leading online B2B marketplace and platform for Indian Manufacturers, Suppliers, Exporters & Service provider, serving as the pivotal link between buyers and suppliers, free online business directory & yellow page with listing Indian & International companies. We provide a platform to empowering generations of entrepreneurs, Small & Medium Enterprises, Large Enterprises as well as individual users. Find here quality products, trade leads, manufacturers, suppliers, exporters & international buyers.",
  keywords:
    'online B2B marketplace, online B2B platform, Business directory, business directory in India, business e-commerce, business listings, B2C online marketplaces in India, Digital commerce platform, business website, business marketplace, companies business listings, companies database india, companies directory, companies directory india, directory of companies, directory of indian companies, service provider, e-commerce in india, trade & commerce, exporter importer directory, exporters business directory, exporters in india, free business listings, free business listings in india, free business marketplace, free indian companies business listings, free manufacturers directory india, importers, india business directory, india export import, india importers, Indian Trade Mart, indian business, Indian companies directory, indian exporters, indian exporters directory, indian manufacturers directory, indian market, indian service providers, manufacturers directory, manufacturers in india, online business directory, suppliers directory, yellow pages, Properties, Builder & Real Estate, Survey & Soil Investigation, Engineering Services, Construction Materials & Machines, Construction Materials & Machines, Electrical Equipment, Electronics & Electrical, R & D and Testing Labs, Business & Audit Services, Product Rental & Leasing, Product Rental & Leasing, Hand & Machine Tools, Mechanical Parts & Spares, Industrial Supplies, Industrial Plants & Machinery, Food & Beverages, Apparel & Garments, Packaging Machines & Goods, Chemicals, Dyes & Solvents, Lab Instruments & Supplies, Furniture & Supplies, Automobile, Parts & Spares, Housewares & Supplies, Metals, Alloys & Minerals, Handicrafts & Decorative, Kitchen Utensils & Appliances, Textiles, Yarn & Fabrics, Books & Stationery, Cosmetics & Personal Care, Home Textile & Furnishing, Drugs & Pharmaceuticals, Gems, Jewelry & Astrology, Computer & IT Solutions, Fashion Accessories & Gear, Herbal & Ayurvedic Product, Security Systems & Services, Sports Goods, Toys & Games, Paper & Paper Products, Bags, Belts & Wallets, Media, PR & Publishing, Marble, Granite & Stones, Event Planner & Organizer, IT & Telecom Services, Transportation & Logistics, Financial & Legal Services, Education & Training, Travel, Tourism & Hotels, Call Center & BPO Services, Bicycle, Rickshaw & Spares, Hospital & Diagnostics, HR Planning & Recruitment, Rail, Shipping & Aviation, House Keeping Services, Leather Products, Misc Contractors & Freelancers, Electronics Components, Hospital, Clinic & Consultation, Construction & Infrastructural Consultant, Album, Movies, Commercial Ads',
};

const DIRECTORY_SEO = {
  title: 'Business Directory, India Business Directory,Companies Directory in India',
  description:
    'India Business Directory - Online business & companies directory with free business listings of indian companies, exporter importer and detailed information about their business profiles. Free list yourself at largest & most trusted business directory in india.',
  keywords:
    'Business directory, india business directory, directory of companies, exporter importer directory, companies directory in india, companies database india, business directory in india, business listings, companies directories, online business directory, free directory, Indian companies directory, free business listings in india, free business listings, business directory, companies directory, business to business companies, directory of indian companies, exporters business directory, companies business listings, companies directory india, free indian companies business listings, indiamart',
};

const fetchHeads = async () => {
  let res = await withSupabaseRetry('head_categories/full', () =>
    supabase
      .from('head_categories')
      .select('id, name, slug, description, meta_tags, keywords')
  );

  if (res.error && isMissingColumnError(res.error)) {
    res = await withSupabaseRetry('head_categories/description', () =>
      supabase
        .from('head_categories')
        .select('id, name, slug, description')
    );
  }

  if (res.error && isMissingColumnError(res.error)) {
    res = await withSupabaseRetry('head_categories/basic', () =>
      supabase
        .from('head_categories')
        .select('id, name, slug')
    );
  }

  if (res.error) {
    console.warn('Head categories fetch failed:', res.error);
    return [];
  }

  return res.data || [];
};

const fetchSubs = async () => {
  let res = await withSupabaseRetry('sub_categories/full', () =>
    supabase
      .from('sub_categories')
      .select('id, name, slug, description, meta_tags, keywords, head_categories!inner(id, name, slug)')
  );

  if (res.error && isMissingColumnError(res.error)) {
    res = await withSupabaseRetry('sub_categories/description', () =>
      supabase
        .from('sub_categories')
        .select('id, name, slug, description, head_categories!inner(id, name, slug)')
    );
  }

  if (res.error && isMissingColumnError(res.error)) {
    res = await withSupabaseRetry('sub_categories/basic', () =>
      supabase
        .from('sub_categories')
        .select('id, name, slug, head_categories!inner(id, name, slug)')
    );
  }

  if (res.error) {
    console.warn('Sub categories fetch failed:', res.error);
    return [];
  }

  return res.data || [];
};

const fetchMicros = async () => {
  const res = await withSupabaseRetry('micro_categories/basic', () =>
    supabase
      .from('micro_categories')
      .select(
        'id, name, slug, sub_categories!inner(id, name, slug, head_categories!inner(id, name, slug))'
      )
  );

  if (res.error) {
    console.warn('Micro categories fetch failed:', res.error);
    return [];
  }

  return res.data || [];
};

const fetchMicroMetaMap = async (ids) => {
  const map = new Map();
  const chunks = chunkArray(ids, 100);

  for (const chunk of chunks) {
    let res = await withSupabaseRetry('micro_category_meta/full', () =>
      supabase
        .from('micro_category_meta')
        .select('micro_categories, meta_tags, description, keywords')
        .in('micro_categories', chunk)
    );

    if (res.error && isMissingColumnError(res.error)) {
      res = await withSupabaseRetry('micro_category_meta/description', () =>
        supabase
          .from('micro_category_meta')
          .select('micro_categories, meta_tags, description')
          .in('micro_categories', chunk)
      );
    }

    if (res.error) {
      console.warn('Micro meta fetch failed:', res.error);
      continue;
    }

    (res.data || []).forEach((row) => {
      map.set(row.micro_categories, row);
    });
  }

  return map;
};

const deriveHeadsFromSubs = (subs = []) => {
  const map = new Map();
  (subs || []).forEach((sub) => {
    const head = sub?.head_categories;
    const slug = String(head?.slug || '').trim();
    if (!slug) return;
    const key = String(head?.id || slug).trim();
    if (map.has(key)) return;
    map.set(key, {
      id: head?.id || key,
      name: head?.name || slug,
      slug,
      description: null,
      meta_tags: null,
      keywords: null,
    });
  });
  return Array.from(map.values());
};

const run = async () => {
  writeRoute('/', {
    title: HOME_SEO.title,
    description: HOME_SEO.description,
    keywords: HOME_SEO.keywords,
    canonical: `${BASE_URL}/`,
  });

  writeRoute('/directory', {
    title: DIRECTORY_SEO.title,
    description: DIRECTORY_SEO.description,
    keywords: DIRECTORY_SEO.keywords,
    canonical: `${BASE_URL}/directory`,
  });

  let [heads, subs, micros] = await Promise.all([fetchHeads(), fetchSubs(), fetchMicros()]);
  if ((!heads || heads.length === 0) && Array.isArray(subs) && subs.length > 0) {
    heads = deriveHeadsFromSubs(subs);
    console.warn(
      `Head categories fetch unavailable. Derived ${heads.length} head routes from sub-categories fallback.`
    );
  }
  const microMetaMap = await fetchMicroMetaMap(micros.map((m) => m.id).filter(Boolean));

  heads.forEach((head) => {
    const title = head.meta_tags || `${head.name} | IndianTradeMart`;
    const description = head.description || `Browse ${head.name} categories on IndianTradeMart.`;
    const keywords = head.keywords || buildKeywords(head.name, 'suppliers', 'manufacturers', 'IndianTradeMart');
    writeRoute(`/directory/${head.slug}`, {
      title,
      description,
      keywords,
      canonical: `${BASE_URL}/directory/${head.slug}`,
    });
  });

  subs.forEach((sub) => {
    const head = sub.head_categories;
    if (!head?.slug) return;

    const title = sub.meta_tags || `${sub.name} | ${head.name} - IndianTradeMart`;
    const description = sub.description || `Browse ${sub.name} sub-categories under ${head.name}.`;
    const keywords = sub.keywords || buildKeywords(sub.name, head.name, 'suppliers', 'products', 'IndianTradeMart');

    writeRoute(`/directory/${head.slug}/${sub.slug}`, {
      title,
      description,
      keywords,
      canonical: `${BASE_URL}/directory/${head.slug}/${sub.slug}`,
    });
  });

  micros.forEach((micro) => {
    const sub = micro.sub_categories;
    const head = sub?.head_categories;
    if (!sub?.slug || !head?.slug) return;

    const meta = microMetaMap.get(micro.id) || {};
    const title = meta.meta_tags || `${micro.name} Suppliers & Manufacturers | ${sub.name} - ${head.name} | IndianTradeMart`;
    const description = meta.description || `Browse ${micro.name} products and suppliers on IndianTradeMart.`;
    const keywords = meta.keywords || buildKeywords(meta.meta_tags, micro.name, sub.name, head.name, 'suppliers', 'manufacturers');

    writeRoute(`/directory/${head.slug}/${sub.slug}/${micro.slug}`, {
      title,
      description,
      keywords,
      canonical: `${BASE_URL}/directory/${head.slug}/${sub.slug}/${micro.slug}`,
    });
  });

  console.log(`✅ SEO prerender complete. Generated ${heads.length} head, ${subs.length} sub, ${micros.length} micro pages.`);
};

run().catch((err) => {
  console.error('SEO prerender failed:', err);
  process.exit(1);
});
