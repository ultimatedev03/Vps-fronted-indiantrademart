const SITE_URL = 'https://indiantrademart.com';

export const normalizeSeoPath = (value = '/') => {
  const raw = String(value || '/').trim();
  let pathname = raw;
  try {
    pathname = raw.startsWith('http://') || raw.startsWith('https://') ? new URL(raw).pathname : raw;
  } catch {
    pathname = raw;
  }
  const normalized = `/${pathname.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '/' : normalized.toLowerCase();
};

const normalizeDate = (value) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, 10) : undefined;
};

export const mapPageSeoOverride = (row) => {
  if (!row || typeof row !== 'object') return null;
  const path = normalizeSeoPath(row.path || row.page_path || row.pagePath);
  const canonical = String(row.canonical || row.canonical_url || row.canonicalUrl || `${SITE_URL}${path}`).trim();
  const title = String(row.title || row.meta_title || row.metaTitle || '').trim();
  if (!path || !title) return null;

  return {
    id: row.id || null,
    path,
    pageName: String(row.pageName || row.page_name || title).trim(),
    title,
    description: String(row.description || row.meta_description || row.metaDescription || '').trim(),
    h1: String(row.h1 || row.page_h1 || row.pageH1 || '').trim(),
    canonical,
    keywords: String(row.keywords || row.meta_keywords || row.metaKeywords || '').trim(),
    schemaKind: String(row.schemaKind || row.schema_kind || row.schemaType || 'web-page').trim(),
    dateModified: normalizeDate(row.dateModified || row.date_modified || row.updated_at),
  };
};

export const readEmbeddedPageSeoOverride = (pathname) => {
  if (typeof document === 'undefined') return null;
  const node = document.querySelector('script[data-page-seo-record="true"]');
  if (!node?.textContent) return null;
  try {
    const record = mapPageSeoOverride(JSON.parse(node.textContent));
    return record?.path === normalizeSeoPath(pathname) ? record : null;
  } catch {
    return null;
  }
};

const titleCaseSlug = (value = '') =>
  String(value || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const buildBreadcrumbItems = (override) => {
  const parts = override.path.split('/').filter(Boolean);
  const items = [{ name: 'Home', item: `${SITE_URL}/` }];
  let current = '';

  parts.forEach((part, index) => {
    current += `/${part}`;
    const isLast = index === parts.length - 1;
    items.push({
      name: isLast ? override.pageName : titleCaseSlug(part === 'search' ? 'Directory Search' : part),
      item: `${SITE_URL}${current}`,
    });
  });

  return items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.item,
  }));
};

const getSearchLocation = (path) => {
  const parts = normalizeSeoPath(path).split('/').filter(Boolean);
  const searchIndex = parts.indexOf('search');
  if (searchIndex < 0) return {};
  const [, stateSlug = '', districtSlug = '', citySlug = ''] = parts.slice(searchIndex + 1);
  return {
    state: titleCaseSlug(stateSlug),
    district: titleCaseSlug(districtSlug),
    city: titleCaseSlug(citySlug),
  };
};

const buildFaq = (override) => ({
  '@type': 'FAQPage',
  '@id': `${override.canonical}#faq`,
  mainEntity: [
    {
      '@type': 'Question',
      name: `How can I find ${override.pageName} on Indian Trade Mart?`,
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Review the listings on this page, compare available business information and send an enquiry through Indian Trade Mart.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I request quotations from listed suppliers?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Buyers can submit a requirement or contact relevant suppliers through the marketplace enquiry flow.',
      },
    },
  ],
});

export const buildPageSeoSchema = (rawOverride) => {
  const override = mapPageSeoOverride(rawOverride);
  if (!override) return null;
  const dateModified = override.dateModified || '2026-07-16';

  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'Indian Trade Mart',
      url: `${SITE_URL}/`,
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Indian Trade Mart',
      alternateName: 'IndianTradeMart',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/itm-logo.webp`,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${override.canonical}#breadcrumb`,
      itemListElement: buildBreadcrumbItems(override),
    },
    {
      '@type': 'WebPage',
      '@id': `${override.canonical}#webpage`,
      url: override.canonical,
      name: override.title,
      headline: override.h1,
      description: override.description,
      dateModified,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      breadcrumb: { '@id': `${override.canonical}#breadcrumb` },
    },
  ];

  if (override.schemaKind === 'category' || override.schemaKind === 'service-category') {
    graph.push({
      '@type': 'CollectionPage',
      '@id': `${override.canonical}#collection`,
      url: override.canonical,
      name: override.h1,
      description: override.description,
      dateModified,
      mainEntity: {
        '@type': 'ItemList',
        '@id': `${override.canonical}#items`,
        name: `${override.pageName} listings`,
      },
    });
  }

  if (override.schemaKind === 'service-category' || override.schemaKind === 'local-service') {
    graph.push({
      '@type': 'Service',
      '@id': `${override.canonical}#service`,
      name: override.pageName,
      description: override.description,
      url: override.canonical,
      provider: { '@id': `${SITE_URL}/#organization` },
      areaServed: { '@type': 'Country', name: 'India' },
    });
  }

  if (override.schemaKind === 'local-business' || override.schemaKind === 'local-service') {
    const location = getSearchLocation(override.path);
    graph.push({
      '@type': 'LocalBusiness',
      '@id': `${override.canonical}#business`,
      name: override.pageName.replace(/\s+[–-]\s+.*$/, ''),
      description: override.description,
      url: override.canonical,
      address: {
        '@type': 'PostalAddress',
        addressLocality: location.city || location.district || undefined,
        addressRegion: location.state || undefined,
        addressCountry: 'IN',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'sales enquiries',
        url: override.canonical,
      },
    });
  }

  if (override.schemaKind === 'product') {
    graph.push({
      '@type': 'Product',
      '@id': `${override.canonical}#product`,
      name: override.pageName,
      description: override.description,
      url: override.canonical,
      brand: { '@type': 'Brand', name: override.pageName.split(/\s+/)[0] || 'Indian Trade Mart' },
      offers: { '@id': `${override.canonical}#offer` },
    });
    graph.push({
      '@type': 'Offer',
      '@id': `${override.canonical}#offer`,
      url: override.canonical,
      description: 'Request a quotation from verified suppliers on Indian Trade Mart.',
      seller: { '@id': `${SITE_URL}/#organization` },
    });
  }

  graph.push(buildFaq(override));

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
};
