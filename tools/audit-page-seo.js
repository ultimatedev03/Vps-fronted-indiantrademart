import fs from 'fs';
import path from 'path';
import { PAGE_SEO_OVERRIDES } from './pageSeoSeedData.js';
import { db, FRONTEND_DIR } from './mysqlToolClient.js';

const decodeHtml = (value = '') =>
  String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const readTagValue = (html, pattern, label, route) => {
  const match = html.match(pattern);
  if (!match) throw new Error(`${route}: missing ${label}`);
  return decodeHtml(match[1]);
};

const expectedFields = (record) => ({
  page_name: record.pageName,
  meta_title: record.title,
  meta_description: record.description,
  h1: record.h1,
  canonical_url: record.canonical,
  meta_keywords: record.keywords,
  schema_kind: record.schemaKind,
  schema_types: record.schemaTypes.join(', '),
});

const assertEqual = (actual, expected, label) => {
  if (String(actual ?? '') !== String(expected ?? '')) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

const run = async () => {
  const { data, error } = await db
    .from('page_seo_overrides')
    .select(
      'path, page_name, meta_title, meta_description, h1, canonical_url, meta_keywords, schema_kind, schema_types, schema_json, is_active'
    )
    .eq('is_active', 1)
    .order('path');
  if (error) throw error;

  const dbByPath = new Map((data || []).map((row) => [row.path, row]));
  if (dbByPath.size < PAGE_SEO_OVERRIDES.length) {
    throw new Error(
      `active DB record count: expected at least ${PAGE_SEO_OVERRIDES.length}, received ${dbByPath.size}`
    );
  }

  let dbChecks = 0;
  let htmlChecks = 0;
  for (const expected of PAGE_SEO_OVERRIDES) {
    const dbRow = dbByPath.get(expected.path);
    if (!dbRow) throw new Error(`${expected.path}: missing DB row`);
    for (const [field, value] of Object.entries(expectedFields(expected))) {
      assertEqual(dbRow[field], value, `${expected.path} DB ${field}`);
      dbChecks += 1;
    }
    let dbSchema;
    try {
      dbSchema =
        typeof dbRow.schema_json === 'string'
          ? JSON.parse(dbRow.schema_json)
          : dbRow.schema_json;
    } catch {
      throw new Error(`${expected.path}: DB schema_json is not valid JSON`);
    }
    assertEqual(
      JSON.stringify(dbSchema),
      JSON.stringify(expected.schemaJson),
      `${expected.path} DB schema_json`
    );
    dbChecks += 1;

    const htmlPath = path.join(
      FRONTEND_DIR,
      'dist',
      expected.path.replace(/^\/+|\/+$/g, ''),
      'index.html'
    );
    const html = fs.readFileSync(htmlPath, 'utf8');
    const title = readTagValue(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i, 'title', expected.path);
    const description = readTagValue(
      html,
      /<meta\b[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,
      'description',
      expected.path
    );
    const keywords = readTagValue(
      html,
      /<meta\b[^>]*name=["']keywords["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,
      'keywords',
      expected.path
    );
    const canonical = readTagValue(
      html,
      /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([\s\S]*?)["'][^>]*>/i,
      'canonical',
      expected.path
    );
    const h1 = readTagValue(
      html,
      /<section class=["']itm-public-fallback-hero["']>[\s\S]*?<h1>([\s\S]*?)<\/h1>/i,
      'H1',
      expected.path
    );
    const embedded = JSON.parse(
      readTagValue(
        html,
        /<script\s+data-page-seo-record=["']true["'][^>]*>([\s\S]*?)<\/script>/i,
        'embedded SEO record',
        expected.path
      )
    );
    const schema = JSON.parse(
      readTagValue(
        html,
        /<script\s+data-page-seo=["']true["'][^>]*>([\s\S]*?)<\/script>/i,
        'JSON-LD',
        expected.path
      )
    );

    assertEqual(title, expected.title, `${expected.path} HTML title`);
    assertEqual(description, expected.description, `${expected.path} HTML description`);
    assertEqual(keywords, expected.keywords, `${expected.path} HTML keywords`);
    assertEqual(canonical, expected.canonical, `${expected.path} HTML canonical`);
    assertEqual(h1, expected.h1, `${expected.path} HTML H1`);
    assertEqual(embedded.path, expected.path, `${expected.path} embedded path`);
    if (
      !Array.isArray(schema?.['@graph']) ||
      !schema['@graph'].some((item) =>
        ['WebPage', 'SearchResultsPage'].includes(item?.['@type'])
      )
    ) {
      throw new Error(`${expected.path}: JSON-LD page node missing`);
    }
    htmlChecks += 7;
  }

  console.log(
    `Page SEO audit passed: ${PAGE_SEO_OVERRIDES.length} routes, ${dbChecks} DB checks, ${htmlChecks} HTML/schema checks.`
  );
};

run()
  .catch((error) => {
    console.error('Page SEO audit failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => db.close());
