import { PAGE_SEO_OVERRIDES } from './pageSeoSeedData.js';
import { db } from './mysqlToolClient.js';

const DATE_MODIFIED = '2026-07-16';
const CHUNK_SIZE = 100;

const rows = PAGE_SEO_OVERRIDES.map((record) => ({
  path: record.path,
  page_name: record.pageName,
  meta_title: record.title,
  meta_description: record.description,
  h1: record.h1,
  canonical_url: record.canonical,
  meta_keywords: record.keywords,
  schema_kind: record.schemaKind,
  date_modified: DATE_MODIFIED,
  is_active: 1,
}));

const run = async () => {
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE);
    const { error } = await db
      .from('page_seo_overrides')
      .upsert(chunk, { onConflict: 'path' });
    if (error) throw error;
  }

  const { data, error } = await db
    .from('page_seo_overrides')
    .select('path, meta_title, canonical_url, is_active')
    .eq('is_active', 1)
    .order('path');
  if (error) throw error;

  const seededPaths = new Set((data || []).map((row) => row.path));
  const missing = rows.filter((row) => !seededPaths.has(row.path));
  if (missing.length) throw new Error(`SEO seed verification failed for ${missing.length} paths`);

  console.log(`Page SEO seed complete: ${rows.length} records upserted and verified.`);
};

run()
  .catch((error) => {
    console.error('Page SEO seed failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => db.close());
