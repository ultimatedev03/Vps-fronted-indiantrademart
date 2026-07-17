const SITE_URL = 'https://indiantrademart.com';

const RAW_PAGE_SEO_OVERRIDES = [
  {
    path: '/directory/album-movies-commercial-ads/feature-films/art-house-festival-films',
    pageName: 'Art House Festival Films',
    title: 'Art House Festival Films Manufacturers & Suppliers | Indian Trade Mart',
    description:
      'Discover verified Art House Festival Films manufacturers, suppliers, production companies and service providers in India. Compare services and connect with trusted businesses.',
    h1: 'Art House Festival Films Manufacturers & Suppliers in India',
    keywords:
      'Art House Festival Films, Festival Film Production, Independent Film Makers, Art Film Production, Feature Film Production, Film Production Companies India, Film Services, Movie Production, B2B Film Directory, Indian Trade Mart',
    schemaKind: 'category',
  },
  {
    path: '/directory/search/reso-dynamics/maharashtra/yavatmal/ner',
    pageName: 'Reso Dynamics - Ner, Yavatmal',
    title: 'Reso Dynamics in Ner, Yavatmal | Verified Supplier | Indian Trade Mart',
    description:
      'Find Reso Dynamics in Ner, Yavatmal, Maharashtra. View verified business details, products, contact information and send direct enquiries through Indian Trade Mart.',
    h1: 'Reso Dynamics – Verified Manufacturer & Supplier in Ner, Yavatmal',
    keywords:
      'Reso Dynamics, Reso Dynamics Ner, Reso Dynamics Yavatmal, Manufacturer in Ner, Supplier in Yavatmal, Industrial Supplier Maharashtra, Verified Business, B2B Marketplace India, Industrial Products, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/reso-dynamics/andhra-pradesh/anantapur/raptadu',
    pageName: 'Reso Dynamics - Raptadu',
    title: 'Reso Dynamics in Raptadu, Andhra Pradesh | Indian Trade Mart',
    description:
      'Explore Reso Dynamics in Raptadu, Andhra Pradesh. Access verified supplier information, business profile, products and contact details on Indian Trade Mart.',
    h1: 'Reso Dynamics – Verified Supplier in Raptadu, Andhra Pradesh',
    keywords:
      'Reso Dynamics, Reso Dynamics Raptadu, Reso Dynamics Anantapur, Manufacturer in Raptadu, Supplier in Anantapur, Industrial Supplier Andhra Pradesh, Verified Business Listing, B2B Marketplace, Industrial Products, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/reso-dynamics/chhattisgarh/janjgir-champa/champa',
    pageName: 'Reso Dynamics - Champa',
    title: 'Reso Dynamics in Champa, Chhattisgarh | Indian Trade Mart',
    description:
      'Discover Reso Dynamics in Champa, Chhattisgarh. Browse verified business information, products, services and connect with trusted suppliers today.',
    h1: 'Reso Dynamics – Verified Manufacturer & Supplier in Champa',
    keywords:
      'Reso Dynamics, Reso Dynamics Champa, Reso Dynamics Janjgir Champa, Manufacturer in Champa, Supplier in Chhattisgarh, Industrial Products, Verified Supplier India, B2B Directory, Business Listing, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/reso-dynamics/andhra-pradesh/tirupati/yerpedu',
    pageName: 'Reso Dynamics - Yerpedu',
    title: 'Reso Dynamics in Yerpedu, Tirupati | Verified Supplier',
    description:
      'Find Reso Dynamics in Yerpedu, Tirupati. Explore verified company profile, products, business details and send enquiries directly through Indian Trade Mart.',
    h1: 'Reso Dynamics – Verified Supplier in Yerpedu, Tirupati',
    keywords:
      'Reso Dynamics, Reso Dynamics Yerpedu, Reso Dynamics Tirupati, Manufacturer in Yerpedu, Supplier in Tirupati, Industrial Supplier Andhra Pradesh, Verified Business, B2B Marketplace, Industrial Products, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/reso-dynamics/haryana/bhiwani/tosham',
    pageName: 'Reso Dynamics - Tosham',
    title: 'Reso Dynamics in Tosham, Bhiwani | Verified Supplier | Indian Trade Mart',
    description:
      'Discover Reso Dynamics in Tosham, Bhiwani, Haryana. Explore verified company profile, products, services and contact details on Indian Trade Mart.',
    h1: 'Reso Dynamics – Verified Manufacturer & Supplier in Tosham, Bhiwani',
    keywords:
      'Reso Dynamics, Reso Dynamics Tosham, Reso Dynamics Bhiwani, Manufacturer in Tosham, Supplier in Haryana, Industrial Products, Verified Business Haryana, B2B Supplier, Business Directory India, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/reso-dynamics/odisha/ganjam/khalikote',
    pageName: 'Reso Dynamics - Khalikote',
    title: 'Reso Dynamics in Khalikote, Ganjam | Verified Supplier | Indian Trade Mart',
    description:
      'Connect with Reso Dynamics in Khalikote, Ganjam, Odisha. Browse verified business information, products and send direct enquiries online.',
    h1: 'Reso Dynamics – Verified Manufacturer & Supplier in Khalikote, Ganjam',
    keywords:
      'Reso Dynamics, Reso Dynamics Khalikote, Reso Dynamics Ganjam, Manufacturer in Khalikote, Supplier in Odisha, Industrial Supplier India, Verified Business, B2B Marketplace, Industrial Products, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/eagle-enterprises/chhattisgarh/surguja/lundra',
    pageName: 'Eagle Enterprises - Lundra',
    title: 'Eagle Enterprises in Lundra, Surguja | Verified Supplier | Indian Trade Mart',
    description:
      'Find Eagle Enterprises in Lundra, Surguja, Chhattisgarh. View verified business profile, products, contact details and connect with trusted suppliers.',
    h1: 'Eagle Enterprises – Verified Manufacturer & Supplier in Lundra, Surguja',
    keywords:
      'Eagle Enterprises, Eagle Enterprises Lundra, Eagle Enterprises Surguja, Manufacturer in Lundra, Supplier in Chhattisgarh, Verified Business, Industrial Products, B2B Marketplace India, Business Directory, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/reso-dynamics/andhra-pradesh/prakasam/kurichedu',
    pageName: 'Reso Dynamics - Kurichedu',
    title: 'Reso Dynamics in Kurichedu, Prakasam | Verified Supplier | Indian Trade Mart',
    description:
      'Explore Reso Dynamics in Kurichedu, Prakasam, Andhra Pradesh. Access verified supplier information, products, services and business contact details.',
    h1: 'Reso Dynamics – Verified Manufacturer & Supplier in Kurichedu, Prakasam',
    keywords:
      'Reso Dynamics, Reso Dynamics Kurichedu, Reso Dynamics Prakasam, Manufacturer in Kurichedu, Supplier in Andhra Pradesh, Industrial Products, Verified Business Listing, B2B Marketplace, Business Directory India, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/reso-dynamics/nagaland/zunheboto/suruhuto',
    pageName: 'Reso Dynamics - Suruhuto',
    title: 'Reso Dynamics in Suruhuto, Zunheboto | Verified Supplier | Indian Trade Mart',
    description:
      'Discover Reso Dynamics in Suruhuto, Zunheboto, Nagaland. Browse verified business details, products and connect with trusted suppliers on Indian Trade Mart.',
    h1: 'Reso Dynamics – Verified Manufacturer & Supplier in Suruhuto, Zunheboto',
    keywords:
      'Reso Dynamics, Reso Dynamics Suruhuto, Reso Dynamics Zunheboto, Manufacturer in Suruhuto, Supplier in Nagaland, Industrial Supplier India, Verified Business, B2B Marketplace, Industrial Products, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/industrial-supplies/industrial-pipe-and-tube-fittings/pipe-connectors',
    pageName: 'Pipe Connectors',
    title: 'Pipe Connectors Manufacturers & Suppliers in India | Indian Trade Mart',
    description:
      'Find verified Pipe Connector manufacturers, suppliers, exporters and wholesalers across India. Compare products, request quotes and connect with trusted businesses.',
    h1: 'Pipe Connectors Manufacturers & Suppliers in India',
    keywords:
      'Pipe Connectors, Pipe Connector Manufacturers, Pipe Connector Suppliers, Pipe Connector Exporters, Industrial Pipe Fittings, Tube Fittings, Pipe Connector Dealers, Industrial Supplies India, Wholesale Pipe Connectors, Indian Trade Mart',
    schemaKind: 'category',
    canonicalTrailingSlash: true,
  },
  {
    path: '/directory/search/reso-dynamics/madhya-pradesh/khargone/maheshwar',
    pageName: 'Reso Dynamics - Maheshwar',
    title: 'Reso Dynamics in Maheshwar, Khargone | Verified Supplier | Indian Trade Mart',
    description:
      'Find Reso Dynamics in Maheshwar, Khargone, Madhya Pradesh. Explore verified business profile, products, services and contact details.',
    h1: 'Reso Dynamics – Verified Manufacturer & Supplier in Maheshwar, Khargone',
    keywords:
      'Reso Dynamics, Reso Dynamics Maheshwar, Reso Dynamics Khargone, Manufacturer in Maheshwar, Supplier in Khargone, Industrial Supplier MP, Verified Business, B2B Marketplace India, Industrial Products, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/towkart-technology-llp/haryana/charkhi-dadri/dadri',
    pageName: 'Towkart Technology LLP - Dadri',
    title: 'Towkart Technology LLP in Dadri | Verified Business | Indian Trade Mart',
    description:
      'Discover Towkart Technology LLP in Dadri, Haryana. View verified business details, products, services and connect with trusted suppliers.',
    h1: 'Towkart Technology LLP – Verified Business in Dadri, Haryana',
    keywords:
      'Towkart Technology LLP, Towkart Dadri, Technology Company Haryana, Verified Business Haryana, Industrial Solutions, Business Services India, B2B Supplier, Technology Provider, Business Directory India, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/media-pr-and-publishing/reference-books-and-study-material/study-guides',
    pageName: 'Study Guides',
    title: 'Study Guides Manufacturers & Suppliers in India | Indian Trade Mart',
    description:
      'Browse verified Study Guide manufacturers, publishers, suppliers and distributors in India. Compare products and connect with trusted businesses.',
    h1: 'Study Guides Manufacturers & Suppliers in India',
    keywords:
      'Study Guides, Study Guide Publishers, Study Guide Suppliers, Educational Books, Reference Books, Academic Study Material, Book Distributors India, Educational Publishers, Wholesale Study Guides, Indian Trade Mart',
    schemaKind: 'category',
    canonicalTrailingSlash: true,
  },
  {
    path: '/directory/business-and-audit-services/start-up-services/company-registration-azerbaijan',
    pageName: 'Company Registration Azerbaijan',
    title: 'Company Registration Azerbaijan Services | Indian Trade Mart',
    description:
      'Connect with verified Company Registration consultants in Azerbaijan. Compare business setup services and request expert assistance.',
    h1: 'Company Registration Services in Azerbaijan',
    keywords:
      'Company Registration Azerbaijan, Business Registration Azerbaijan, Company Formation Azerbaijan, Startup Registration, Business Setup Services, Legal Registration Services, Business Consultants, International Business Setup, Corporate Registration, Indian Trade Mart',
    schemaKind: 'service-category',
    canonicalTrailingSlash: true,
  },
  {
    path: '/directory/search/omxe-power-tools-marble-granite-tile-cutting-disc-125mm/chhattisgarh/bilaspur/takhatpur',
    pageName: 'OMXE Marble Granite Tile Cutting Disc',
    title: 'OMXE Marble Granite Tile Cutting Disc 125mm | Indian Trade Mart',
    description:
      'Buy OMXE Marble Granite Tile Cutting Disc 125mm from verified suppliers. Compare specifications, prices and contact trusted sellers across India.',
    h1: 'OMXE Marble Granite Tile Cutting Disc 125mm',
    keywords:
      'OMXE Cutting Disc, Marble Cutting Disc, Granite Cutting Disc, Tile Cutting Disc 125mm, Power Tool Accessories, Cutting Disc Suppliers, Industrial Power Tools, Abrasive Cutting Disc, Verified Supplier India, Indian Trade Mart',
    schemaKind: 'product',
  },
  {
    path: '/directory/electrical-equipment/fuses-circuit-breakers-and-components/mcb',
    pageName: 'MCB Category',
    title: 'MCB Manufacturers, Suppliers & Dealers in India | Indian Trade Mart',
    description:
      'Find verified MCB manufacturers, suppliers, wholesalers and exporters across India. Compare products and request the best quotations online.',
    h1: 'MCB Manufacturers & Suppliers in India',
    keywords:
      'MCB, Miniature Circuit Breaker, MCB Manufacturers, MCB Suppliers, Electrical Components, Circuit Breakers, Electrical Equipment India, MCB Dealers, Electrical Products, Indian Trade Mart',
    schemaKind: 'category',
    canonicalTrailingSlash: true,
  },
  {
    path: '/directory/search/reso-dynamics/madhya-pradesh/panna/pawai',
    pageName: 'Reso Dynamics - Pawai',
    title: 'Reso Dynamics in Pawai, Panna | Verified Supplier | Indian Trade Mart',
    description:
      'Explore Reso Dynamics in Pawai, Panna, Madhya Pradesh. View verified business profile, products and contact details on Indian Trade Mart.',
    h1: 'Reso Dynamics – Verified Manufacturer & Supplier in Pawai, Panna',
    keywords:
      'Reso Dynamics, Reso Dynamics Pawai, Reso Dynamics Panna, Manufacturer in Pawai, Supplier in Panna, Industrial Products, Verified Supplier MP, B2B Marketplace India, Industrial Business, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/reso-dynamics/nagaland/tuensang/chare',
    pageName: 'Reso Dynamics - Chare',
    title: 'Reso Dynamics in Chare, Tuensang | Verified Supplier | Indian Trade Mart',
    description:
      'Discover Reso Dynamics in Chare, Tuensang, Nagaland. Browse verified business details, products and connect with trusted suppliers.',
    h1: 'Reso Dynamics – Verified Manufacturer & Supplier in Chare, Tuensang',
    keywords:
      'Reso Dynamics, Reso Dynamics Chare, Reso Dynamics Tuensang, Manufacturer Nagaland, Supplier Nagaland, Industrial Supplier India, Verified Business Listing, B2B Directory India, Industrial Products, Indian Trade Mart',
    schemaKind: 'local-business',
  },
  {
    path: '/directory/search/renovating-demolition/odisha/khordha/jankia',
    pageName: 'Renovating & Demolition Services - Jankia',
    title: 'Renovating & Demolition Services in Jankia | Indian Trade Mart',
    description:
      'Find trusted Renovating and Demolition service providers in Jankia, Khordha, Odisha. Compare verified businesses and request service quotations.',
    h1: 'Renovating & Demolition Services in Jankia, Khordha',
    keywords:
      'Renovating Services, Demolition Services, Building Demolition, House Renovation, Commercial Renovation, Demolition Contractors, Construction Services Odisha, Renovation Contractors, Building Services India, Indian Trade Mart',
    schemaKind: 'local-service',
  },
];

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

export const PAGE_SEO_OVERRIDES = Object.freeze(
  RAW_PAGE_SEO_OVERRIDES.map((row) =>
    Object.freeze({
      ...row,
      path: normalizeSeoPath(row.path),
      canonical: `${SITE_URL}${normalizeSeoPath(row.path)}${row.canonicalTrailingSlash ? '/' : ''}`,
    })
  )
);

const OVERRIDE_BY_PATH = new Map(PAGE_SEO_OVERRIDES.map((row) => [row.path, row]));

export const getPageSeoOverride = (pathname) => OVERRIDE_BY_PATH.get(normalizeSeoPath(pathname)) || null;

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
        text: `Review the listings on this page, compare available business information and send an enquiry through Indian Trade Mart.`,
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

export const buildPageSeoSchema = (override) => {
  if (!override) return null;

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
      dateModified: '2026-07-16',
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
      dateModified: '2026-07-16',
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
      brand: { '@type': 'Brand', name: 'OMXE' },
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
