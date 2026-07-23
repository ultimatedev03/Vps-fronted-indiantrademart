const SITE_URL = 'https://indiantrademart.com';
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

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

const parseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
};

const normalizeSchemaDocument = (value) => {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed)) {
    return { '@context': 'https://schema.org', '@graph': parsed.filter(Boolean) };
  }
  if (Array.isArray(parsed['@graph'])) {
    return {
      ...parsed,
      '@context': parsed['@context'] || 'https://schema.org',
      '@graph': parsed['@graph'].filter(Boolean),
    };
  }
  if (parsed['@type']) {
    return {
      '@context': parsed['@context'] || 'https://schema.org',
      '@graph': [{ ...parsed, '@context': undefined }],
    };
  }
  return null;
};

export const normalizeSchemaTypes = (value) => {
  const raw = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((item) => item.trim());
  const seen = new Set();
  return raw
    .map((item) => String(item || '').replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
    schemaTypes: normalizeSchemaTypes(row.schemaTypes || row.schema_types),
    schemaJson: normalizeSchemaDocument(row.schemaJson || row.schema_json),
    faqItems: Array.isArray(row.faqItems) ? row.faqItems : [],
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
  if (searchIndex < 0) {
    if (parts.length >= 6) {
      return {
        state: titleCaseSlug(parts.at(-2)),
        district: '',
        city: titleCaseSlug(parts.at(-1)),
      };
    }
    return {};
  }
  const [, stateSlug = '', districtSlug = '', citySlug = ''] = parts.slice(searchIndex + 1);
  return {
    state: titleCaseSlug(stateSlug),
    district: titleCaseSlug(districtSlug),
    city: titleCaseSlug(citySlug),
  };
};

const defaultFaqItems = (override) => [
  {
    question: `How can I find ${override.pageName} on Indian Trade Mart?`,
    answer:
      'Review the listings on this page, compare available business information and send an enquiry through Indian Trade Mart.',
  },
  {
    question: 'Can I request quotations from listed suppliers?',
    answer:
      'Yes. Buyers can submit a requirement or contact relevant suppliers through the marketplace enquiry flow.',
  },
];

const buildFaq = (override) => {
  const source = override.faqItems.length ? override.faqItems : defaultFaqItems(override);
  const mainEntity = source
    .map((item) => ({
      '@type': 'Question',
      name: String(item?.question || item?.name || '').trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: String(item?.answer || item?.acceptedAnswer?.text || '').trim(),
      },
    }))
    .filter((item) => item.name && item.acceptedAnswer.text);

  if (!mainEntity.length) return null;
  return {
    '@type': 'FAQPage',
    '@id': `${override.canonical}#faq`,
    mainEntity,
  };
};

const inferredSchemaTypes = (override) => {
  const types = new Set(override.schemaTypes);
  types.add('Organization');
  types.add('WebPage');
  types.add('BreadcrumbList');

  if (override.schemaKind === 'category' || override.schemaKind === 'service-category') {
    types.add('CollectionPage');
    types.add('ItemList');
  }
  if (override.schemaKind === 'search-results') {
    types.add('SearchResultsPage');
    types.add('ItemList');
  }
  if (override.schemaKind === 'service-category' || override.schemaKind === 'local-service') {
    types.add('Service');
  }
  if (override.schemaKind === 'local-business' || override.schemaKind === 'local-service') {
    types.add('LocalBusiness');
    types.add('PostalAddress');
    types.add('ContactPoint');
  }
  if (override.schemaKind === 'product') {
    types.add('Product');
    types.add('Offer');
  }
  return types;
};

const normalizeListingItems = (items) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const rawUrl = String(item?.url || item?.path || '').trim();
      const name = String(item?.name || item?.title || '').trim();
      if (!rawUrl || !name) return null;
      let url;
      try {
        url = new URL(rawUrl, SITE_URL).toString();
      } catch {
        return null;
      }
      if (!url.startsWith(`${SITE_URL}/`) || seen.has(url)) return null;
      seen.add(url);
      return { name, url };
    })
    .filter(Boolean)
    .slice(0, 50);
};

const appendItemList = (schema, override, items) => {
  const normalizedItems = normalizeListingItems(items);
  if (!normalizedItems.length) return schema;

  const graph = Array.isArray(schema?.['@graph']) ? [...schema['@graph']] : [];
  const itemList = {
    '@type': 'ItemList',
    '@id': `${override.canonical}#items`,
    name: `${override.pageName} listings`,
    numberOfItems: normalizedItems.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: normalizedItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };

  const existingIndex = graph.findIndex((node) => node?.['@type'] === 'ItemList');
  if (existingIndex >= 0) graph[existingIndex] = itemList;
  else graph.push(itemList);

  const collectionIndex = graph.findIndex((node) =>
    ['CollectionPage', 'SearchResultsPage'].includes(node?.['@type'])
  );
  if (collectionIndex >= 0) {
    graph[collectionIndex] = {
      ...graph[collectionIndex],
      mainEntity: { '@id': itemList['@id'] },
    };
  }

  return { ...schema, '@graph': graph };
};

export const buildPageSeoSchema = (rawOverride, options = {}) => {
  const override = mapPageSeoOverride(rawOverride);
  if (!override) return null;
  const schemaTypes = inferredSchemaTypes(override);

  if (override.schemaJson) {
    return schemaTypes.has('ItemList')
      ? appendItemList(override.schemaJson, override, options.items)
      : override.schemaJson;
  }

  const dateModified = override.dateModified || new Date().toISOString().slice(0, 10);
  const graph = [
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: 'Indian Trade Mart',
      url: `${SITE_URL}/`,
      publisher: { '@id': ORGANIZATION_ID },
    },
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'Indian Trade Mart',
      alternateName: 'IndianTradeMart',
      url: `${SITE_URL}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/itm-logo.webp`,
      },
      description:
        "Indian Trade Mart is India's B2B marketplace for manufacturers, suppliers, exporters and buyers.",
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${override.canonical}#breadcrumb`,
      itemListElement: buildBreadcrumbItems(override),
    },
    {
      '@type': schemaTypes.has('SearchResultsPage') ? 'SearchResultsPage' : 'WebPage',
      '@id': `${override.canonical}#webpage`,
      url: override.canonical,
      name: override.title,
      headline: override.h1,
      description: override.description,
      dateModified,
      inLanguage: 'en-IN',
      isPartOf: { '@id': WEBSITE_ID },
      breadcrumb: { '@id': `${override.canonical}#breadcrumb` },
    },
  ];

  if (schemaTypes.has('CollectionPage')) {
    graph.push({
      '@type': 'CollectionPage',
      '@id': `${override.canonical}#collection`,
      url: override.canonical,
      name: override.h1,
      description: override.description,
      dateModified,
      inLanguage: 'en-IN',
      isPartOf: { '@id': WEBSITE_ID },
    });
  }

  if (schemaTypes.has('Service')) {
    graph.push({
      '@type': 'Service',
      '@id': `${override.canonical}#service`,
      name: override.pageName,
      description: override.description,
      url: override.canonical,
      provider: { '@id': ORGANIZATION_ID },
      areaServed: { '@type': 'Country', name: 'India' },
    });
  }

  if (schemaTypes.has('LocalBusiness')) {
    const location = getSearchLocation(override.path);
    const address = {
      '@type': 'PostalAddress',
      addressLocality: location.city || location.district || undefined,
      addressRegion: location.state || undefined,
      addressCountry: 'IN',
    };
    graph.push({
      '@type': schemaTypes.has('MedicalBusiness') ? 'MedicalBusiness' : 'LocalBusiness',
      '@id': `${override.canonical}#business`,
      name: override.pageName.replace(/\s+[–-]\s+.*$/, ''),
      description: override.description,
      url: override.canonical,
      address,
      areaServed: { '@type': 'Country', name: 'India' },
      parentOrganization: { '@id': ORGANIZATION_ID },
      contactPoint: schemaTypes.has('ContactPoint')
        ? {
            '@type': 'ContactPoint',
            contactType: 'sales enquiries',
            url: override.canonical,
          }
        : undefined,
    });
  }

  if (schemaTypes.has('Product')) {
    graph.push({
      '@type': 'Product',
      '@id': `${override.canonical}#product`,
      name: override.pageName,
      description: override.description,
      url: override.canonical,
      offers: schemaTypes.has('Offer') ? { '@id': `${override.canonical}#offer` } : undefined,
    });
    if (schemaTypes.has('Offer')) {
      graph.push({
        '@type': 'Offer',
        '@id': `${override.canonical}#offer`,
        url: override.canonical,
        description: 'Request a quotation from verified suppliers on Indian Trade Mart.',
        availability: 'https://schema.org/InStock',
        seller: { '@id': ORGANIZATION_ID },
      });
    }
  }

  if (schemaTypes.has('FAQPage')) {
    const faq = buildFaq(override);
    if (faq) graph.push(faq);
  }

  const schema = {
    '@context': 'https://schema.org',
    '@graph': graph.filter(Boolean),
  };
  return schemaTypes.has('ItemList')
    ? appendItemList(schema, override, options.items)
    : schema;
};

export const getPageSeoFaqItems = (rawSchema) => {
  const schema = normalizeSchemaDocument(rawSchema);
  const graph = Array.isArray(schema?.['@graph']) ? schema['@graph'] : [];
  const faq = graph.find((node) => node?.['@type'] === 'FAQPage');
  return (Array.isArray(faq?.mainEntity) ? faq.mainEntity : [])
    .map((item) => ({
      question: String(item?.name || '').trim(),
      answer: String(item?.acceptedAnswer?.text || '').trim(),
    }))
    .filter((item) => item.question && item.answer);
};
