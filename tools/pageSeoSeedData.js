import fs from 'node:fs';
import Papa from 'papaparse';
import {
  buildPageSeoSchema,
  normalizeSchemaTypes,
  normalizeSeoPath,
} from '../src/modules/directory/seo/pageSeoOverrides.js';

const SITE_URL = 'https://indiantrademart.com';
const METADATA_SOURCE = new URL('./data/page-seo-overrides.tsv', import.meta.url);
const SCHEMA_SOURCE = new URL('./data/page-seo-schemas.tsv', import.meta.url);
const indiaDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const PAGE_SEO_DATE_MODIFIED =
  String(process.env.PAGE_SEO_DATE_MODIFIED || '').trim() ||
  indiaDate();

const cleanText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const readTsv = (source) => {
  const text = fs.readFileSync(source, 'utf8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse(text, {
    delimiter: '\t',
    skipEmptyLines: 'greedy',
  });
  if (parsed.errors.length) {
    const first = parsed.errors[0];
    throw new Error(`Invalid TSV at row ${first.row ?? 'unknown'}: ${first.message}`);
  }
  return parsed.data;
};

const extractCanonical = (value, fallbackUrl) => {
  const raw = String(value || '').trim();
  const href = raw.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] || raw || fallbackUrl;
  let canonical;
  try {
    canonical = new URL(href, SITE_URL);
  } catch {
    throw new Error(`Invalid canonical URL: ${href}`);
  }
  if (canonical.origin !== SITE_URL) {
    throw new Error(`Canonical must use ${SITE_URL}: ${href}`);
  }
  return canonical.toString();
};

const inferSchemaKind = (path, schemaTypes) => {
  const types = new Set(schemaTypes);
  if (types.has('Product')) return 'product';
  if (types.has('Service') && types.has('LocalBusiness')) return 'local-service';
  if (types.has('Service')) return 'service-category';
  if (types.has('LocalBusiness') || types.has('MedicalBusiness')) return 'local-business';
  if (types.has('CollectionPage')) return 'category';
  if (path.includes('/directory/search/')) return 'search-results';
  return 'category';
};

const inferSchemaTypes = (path, suppliedTypes) => {
  const types = new Set(normalizeSchemaTypes(suppliedTypes));
  types.add('Organization');
  types.add('WebPage');
  types.add('BreadcrumbList');

  if (!suppliedTypes.length) {
    if (path.includes('/directory/search/')) {
      types.add('SearchResultsPage');
      types.add('ItemList');
    } else {
      types.add('CollectionPage');
      types.add('ItemList');
    }
  }

  if (types.has('Product')) types.add('Offer');
  if (types.has('LocalBusiness') || types.has('MedicalBusiness')) {
    types.add('PostalAddress');
    types.add('ContactPoint');
  }
  return [...types];
};

const parseFaqItems = () => {
  const byPath = new Map();
  for (const row of readTsv(SCHEMA_SOURCE)) {
    const rawUrl = cleanText(row?.[0]);
    if (!/^https:\/\/indiantrademart\.com\//i.test(rawUrl)) continue;
    const path = normalizeSeoPath(rawUrl);

    for (const rawSchema of row.slice(1)) {
      const text = String(rawSchema || '').trim();
      if (!text) continue;
      let schema;
      try {
        schema = JSON.parse(text);
      } catch (error) {
        throw new Error(`${path}: invalid schema JSON: ${error.message}`);
      }
      if (schema?.['@type'] !== 'FAQPage') continue;

      const items = (Array.isArray(schema.mainEntity) ? schema.mainEntity : [])
        .map((item) => ({
          question: cleanText(item?.name),
          answer: cleanText(item?.acceptedAnswer?.text),
        }))
        .filter((item) => item.question && item.answer);
      if (items.length) byPath.set(path, items);
    }
  }
  return byPath;
};

const faqItemsByPath = parseFaqItems();
const recordsByPath = new Map();
let sourceRowCount = 0;

for (const row of readTsv(METADATA_SOURCE)) {
  if (!row.some((value) => cleanText(value))) continue;
  if (row.length !== 9) {
    throw new Error(`Metadata row ${sourceRowCount + 1} has ${row.length} columns; expected 9`);
  }

  sourceRowCount += 1;
  const [
    sourceNumber,
    rawUrl,
    rawPageName,
    rawTitle,
    rawDescription,
    rawH1,
    rawCanonical,
    rawKeywords,
    rawSchemaTypes,
  ] = row;

  let sourceUrl;
  try {
    sourceUrl = new URL(cleanText(rawUrl));
  } catch {
    throw new Error(`Metadata row ${sourceNumber || sourceRowCount} has an invalid URL`);
  }
  if (sourceUrl.origin !== SITE_URL) {
    throw new Error(`Metadata row ${sourceNumber || sourceRowCount} uses an unexpected origin`);
  }

  const path = normalizeSeoPath(sourceUrl.pathname);
  const title = cleanText(rawTitle);
  const description = cleanText(rawDescription);
  const h1 = cleanText(rawH1);
  if (!title || !description || !h1) {
    throw new Error(`Metadata row ${sourceNumber || sourceRowCount} is missing title, description or H1`);
  }

  const canonical = extractCanonical(rawCanonical, sourceUrl.toString());
  if (normalizeSeoPath(canonical) !== path) {
    throw new Error(`Metadata row ${sourceNumber || sourceRowCount} canonical does not match its path`);
  }

  const suppliedTypes = normalizeSchemaTypes(rawSchemaTypes);
  const schemaTypes = inferSchemaTypes(path, suppliedTypes);
  const record = {
    sourceNumber: Number(sourceNumber || sourceRowCount),
    path,
    pageName: cleanText(rawPageName) || h1 || title,
    title,
    description,
    h1,
    canonical,
    keywords: cleanText(rawKeywords),
    schemaTypes,
    schemaKind: inferSchemaKind(path, schemaTypes),
    faqItems: faqItemsByPath.get(path) || [],
    dateModified: PAGE_SEO_DATE_MODIFIED,
  };

  // Later spreadsheet rows intentionally win for duplicate/trailing-slash variants.
  recordsByPath.set(path, record);
}

export const PAGE_SEO_SOURCE_ROW_COUNT = sourceRowCount;
export const PAGE_SEO_DUPLICATE_ROW_COUNT = sourceRowCount - recordsByPath.size;

export const PAGE_SEO_OVERRIDES = Object.freeze(
  [...recordsByPath.values()]
    .sort((left, right) => left.sourceNumber - right.sourceNumber)
    .map((record) => {
      const schemaJson = buildPageSeoSchema(record);
      return Object.freeze({
        ...record,
        schemaJson,
      });
    })
);

const OVERRIDE_BY_PATH = new Map(PAGE_SEO_OVERRIDES.map((row) => [row.path, row]));

export const getPageSeoOverride = (pathname) =>
  OVERRIDE_BY_PATH.get(normalizeSeoPath(pathname)) || null;
