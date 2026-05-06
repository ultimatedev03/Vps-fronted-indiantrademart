import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const chunk = (arr, size = 500) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const normalize = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^the\s+/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const slugify = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'division';

const unique = (arr = []) => Array.from(new Set(arr.filter(Boolean)));

function parseArgs() {
  const args = process.argv.slice(2);
  const dataDirArg = args.find((a) => !String(a || '').startsWith('--'));
  const dataDirFlag = args.find((a) => String(a || '').startsWith('--data-dir='));

  const opts = {
    dataDir:
      (dataDirFlag ? String(dataDirFlag.split('=')[1] || '').trim() : '') ||
      dataDirArg ||
      'C:\\Users\\Dipanshu pandey\\OneDrive\\Desktop\\Statewise-postal-code',
    storeRaw: args.includes('--store-raw'),
    dryRun: args.includes('--dry-run'),
    limitFiles: null,
    stateFilter: '',
  };

  const limitArg = args.find((a) => a.startsWith('--limit-files='));
  if (limitArg) {
    const n = Number(limitArg.split('=')[1]);
    if (Number.isFinite(n) && n > 0) opts.limitFiles = n;
  }

  const stateArg = args.find((a) => a.startsWith('--state='));
  if (stateArg) {
    opts.stateFilter = String(stateArg.split('=')[1] || '').trim();
  }

  return opts;
}

async function readCsv(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => String(h || '').trim(),
  });

  if (parsed.errors?.length) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error in ${path.basename(filePath)}: ${first?.message || 'unknown'}`);
  }

  return Array.isArray(parsed.data) ? parsed.data : [];
}

async function loadStateCityMaps() {
  const [{ data: states, error: stateErr }, { data: cities, error: cityErr }] = await Promise.all([
    supabase.from('states').select('id, name'),
    supabase.from('cities').select('id, name, state_id'),
  ]);

  if (stateErr) throw new Error(`Failed to load states: ${stateErr.message}`);
  if (cityErr) throw new Error(`Failed to load cities: ${cityErr.message}`);

  const statesByNorm = new Map();
  (states || []).forEach((s) => {
    const key = normalize(s.name);
    if (!key) return;
    statesByNorm.set(key, {
      id: s.id,
      name: s.name,
      cities: [],
      citiesByNorm: new Map(),
    });
  });

  (cities || []).forEach((c) => {
    const state = [...statesByNorm.values()].find((s) => s.id === c.state_id);
    if (!state) return;
    const cityNorm = normalize(c.name);
    const payload = { id: c.id, name: c.name, norm: cityNorm };
    state.cities.push(payload);
    if (cityNorm) state.citiesByNorm.set(cityNorm, payload);
  });

  return statesByNorm;
}

function pickCityForDivision(stateObj, districtName, subdistrictName) {
  if (!stateObj) return null;
  const districtNorm = normalize(districtName);
  const subdistrictNorm = normalize(subdistrictName);

  if (subdistrictNorm && stateObj.citiesByNorm.has(subdistrictNorm)) {
    return stateObj.citiesByNorm.get(subdistrictNorm);
  }

  if (districtNorm && stateObj.citiesByNorm.has(districtNorm)) {
    return stateObj.citiesByNorm.get(districtNorm);
  }

  if (subdistrictNorm) {
    const contains = stateObj.cities.find(
      (c) => c.norm && (c.norm.includes(subdistrictNorm) || subdistrictNorm.includes(c.norm))
    );
    if (contains) return contains;
  }

  if (districtNorm) {
    const contains = stateObj.cities.find(
      (c) => c.norm && (c.norm.includes(districtNorm) || districtNorm.includes(c.norm))
    );
    if (contains) return contains;
  }

  return null;
}

async function upsertDivisions(divisionRows = [], dryRun = false) {
  if (!divisionRows.length || dryRun) return { inserted: 0, divisionByKey: new Map() };

  const divisionByKey = new Map();
  for (const group of chunk(divisionRows, 400)) {
    const { data, error } = await supabase
      .from('geo_divisions')
      .upsert(group, { onConflict: 'division_key' })
      .select('id, division_key');

    if (error) throw new Error(`Failed to upsert divisions: ${error.message}`);
    (data || []).forEach((d) => {
      if (d?.division_key && d?.id) divisionByKey.set(d.division_key, d.id);
    });
  }

  if (divisionByKey.size < divisionRows.length) {
    const keys = unique(divisionRows.map((d) => d.division_key));
    for (const group of chunk(keys, 500)) {
      const { data, error } = await supabase
        .from('geo_divisions')
        .select('id, division_key')
        .in('division_key', group);
      if (error) throw new Error(`Failed to reload divisions by key: ${error.message}`);
      (data || []).forEach((d) => {
        if (d?.division_key && d?.id) divisionByKey.set(d.division_key, d.id);
      });
    }
  }

  return { inserted: divisionRows.length, divisionByKey };
}

async function upsertDivisionPincodes(divisionPincodeRows = [], dryRun = false) {
  if (!divisionPincodeRows.length || dryRun) return 0;
  for (const group of chunk(divisionPincodeRows, 800)) {
    const { error } = await supabase
      .from('geo_division_pincodes')
      .upsert(group, { onConflict: 'division_id,pincode' });
    if (error) throw new Error(`Failed to upsert division pincodes: ${error.message}`);
  }
  return divisionPincodeRows.length;
}

async function insertRawRows(rawRows = [], dryRun = false) {
  if (!rawRows.length || dryRun) return 0;
  for (const group of chunk(rawRows, 1000)) {
    const { error } = await supabase.from('geo_postal_raw').insert(group);
    if (error) throw new Error(`Failed to insert raw postal rows: ${error.message}`);
  }
  return rawRows.length;
}

function buildDivisionKey({ stateId, stateName, cityId, divisionSlug }) {
  const stateToken = stateId || normalize(stateName) || 'unknown-state';
  const cityToken = cityId || 'unmapped-city';
  return `${stateToken}::${cityToken}::${divisionSlug}`;
}

async function processCsvFile(filePath, statesByNorm, opts) {
  const rows = await readCsv(filePath);
  const sourceFile = path.basename(filePath);
  const divisionAgg = new Map();
  const rawRows = [];

  let unmatchedStateRows = 0;
  let unmappedCityRows = 0;

  rows.forEach((row) => {
    const stateName = String(row.stateNameEnglish || row.stateName || '').trim();
    const districtName = String(row.districtNameEnglish || row.districtName || '').trim();
    const subdistrictName = String(row.subdistrictNameEnglish || row.subdistrictName || '').trim();
    const pincode = String(row.pincode || '').trim();

    if (!stateName || !pincode) return;

    const stateObj = statesByNorm.get(normalize(stateName)) || null;
    if (!stateObj) unmatchedStateRows += 1;

    const city = pickCityForDivision(stateObj, districtName, subdistrictName);
    if (!city) unmappedCityRows += 1;

    const divisionName = subdistrictName || districtName || `Pincode ${pincode}`;
    const divisionSlug = slugify(divisionName);
    const divisionKey = buildDivisionKey({
      stateId: stateObj?.id || null,
      stateName,
      cityId: city?.id || null,
      divisionSlug,
    });

    if (!divisionAgg.has(divisionKey)) {
      divisionAgg.set(divisionKey, {
        division_key: divisionKey,
        state_id: stateObj?.id || null,
        city_id: city?.id || null,
        name: divisionName,
        slug: divisionSlug,
        district_name: districtName || null,
        subdistrict_name: subdistrictName || null,
        pincodeSet: new Set(),
      });
    }

    const agg = divisionAgg.get(divisionKey);
    agg.pincodeSet.add(pincode);

    if (opts.storeRaw) {
      rawRows.push({
        state_code: String(row.stateCode || '').trim() || null,
        state_name: stateName,
        district_code: String(row.districtCode || '').trim() || null,
        district_name: districtName || null,
        subdistrict_code: String(row.subdistrictCode || '').trim() || null,
        subdistrict_name: subdistrictName || null,
        village_code: String(row.villageCode || '').trim() || null,
        village_name: String(row.villageNameEnglish || row.villageName || '').trim() || null,
        pincode,
        source_file: sourceFile,
      });
    }
  });

  const divisionRows = [...divisionAgg.values()].map((d) => ({
    division_key: d.division_key,
    state_id: d.state_id,
    city_id: d.city_id,
    name: d.name,
    slug: d.slug,
    district_name: d.district_name,
    subdistrict_name: d.subdistrict_name,
    pincode_count: d.pincodeSet.size,
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  const { divisionByKey } = await upsertDivisions(divisionRows, opts.dryRun);

  const divisionPincodeRows = [];
  for (const d of divisionAgg.values()) {
    const divisionId = divisionByKey.get(d.division_key);
    if (!divisionId && !opts.dryRun) continue;
    d.pincodeSet.forEach((pincode) => {
      divisionPincodeRows.push({
        division_id: divisionId || '00000000-0000-0000-0000-000000000000',
        pincode,
        source_district_name: d.district_name,
        source_subdistrict_name: d.subdistrict_name,
      });
    });
  }

  const insertedPincodes = opts.dryRun
    ? divisionPincodeRows.length
    : await upsertDivisionPincodes(divisionPincodeRows, opts.dryRun);
  const insertedRaw = await insertRawRows(rawRows, opts.dryRun);

  return {
    sourceFile,
    inputRows: rows.length,
    divisionCount: divisionRows.length,
    pincodeCount: insertedPincodes,
    rawCount: insertedRaw,
    unmatchedStateRows,
    unmappedCityRows,
  };
}

function filterFiles(files, opts) {
  let next = files.filter((f) => f.toLowerCase().endsWith('.csv'));
  if (opts.stateFilter) {
    const needle = normalize(opts.stateFilter);
    next = next.filter((name) => normalize(name.replace(/\.csv$/i, '')).includes(needle));
  }
  if (opts.limitFiles) {
    next = next.slice(0, opts.limitFiles);
  }
  return next;
}

async function main() {
  const opts = parseArgs();
  const files = await fs.readdir(opts.dataDir);
  const csvFiles = filterFiles(files, opts);

  if (!csvFiles.length) {
    // eslint-disable-next-line no-console
    console.log('No CSV files matched filters.');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`Processing ${csvFiles.length} file(s) from: ${opts.dataDir}`);
  // eslint-disable-next-line no-console
  console.log(`Mode: ${opts.dryRun ? 'DRY RUN' : 'WRITE'} | storeRaw=${opts.storeRaw ? 'yes' : 'no'}`);

  const statesByNorm = await loadStateCityMaps();
  const summaries = [];

  for (const file of csvFiles) {
    const absolute = path.join(opts.dataDir, file);
    // eslint-disable-next-line no-console
    console.log(`\n-> ${file}`);
    const summary = await processCsvFile(absolute, statesByNorm, opts);
    summaries.push(summary);
    // eslint-disable-next-line no-console
    console.log(
      `rows=${summary.inputRows}, divisions=${summary.divisionCount}, pincodes=${summary.pincodeCount}, ` +
        `unmappedCityRows=${summary.unmappedCityRows}, unmatchedStateRows=${summary.unmatchedStateRows}`
    );
  }

  const totals = summaries.reduce(
    (acc, s) => {
      acc.rows += s.inputRows;
      acc.divisions += s.divisionCount;
      acc.pincodes += s.pincodeCount;
      acc.raw += s.rawCount;
      acc.unmappedCityRows += s.unmappedCityRows;
      acc.unmatchedStateRows += s.unmatchedStateRows;
      return acc;
    },
    { rows: 0, divisions: 0, pincodes: 0, raw: 0, unmappedCityRows: 0, unmatchedStateRows: 0 }
  );

  // eslint-disable-next-line no-console
  console.log('\n=== Import Summary ===');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(totals, null, 2));
  // eslint-disable-next-line no-console
  console.log('Done.');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error?.message || error);
  process.exit(1);
});
