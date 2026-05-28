import { randomUUID } from 'crypto';
import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';
import dotenv from 'dotenv';

const resolveFrontendDir = () => {
  const override = String(process.env.FRONTEND_DIR || '').trim();
  const candidates = [
    override ? path.resolve(process.cwd(), override) : null,
    process.cwd(),
    path.join(process.cwd(), 'frontend'),
  ].filter(Boolean);

  return (
    candidates.find((candidate) => fs.existsSync(path.join(candidate, 'src')) && fs.existsSync(path.join(candidate, 'public'))) ||
    process.cwd()
  );
};

export const FRONTEND_DIR = resolveFrontendDir();
const repoRoot = path.resolve(FRONTEND_DIR, '..');

[
  path.join(repoRoot, '.env.local'),
  path.join(repoRoot, '.env'),
  path.join(repoRoot, 'backend', '.env.local'),
  path.join(repoRoot, 'backend', '.env'),
  path.join(FRONTEND_DIR, '.env.local'),
  path.join(FRONTEND_DIR, '.env'),
].forEach((envPath) => dotenv.config({ path: envPath }));

const parseMysqlUrl = (rawUrl = '') => {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      database: decodeURIComponent(url.pathname.replace(/^\/+/, '') || ''),
    };
  } catch {
    return null;
  }
};

const urlConfig = parseMysqlUrl(process.env.MYSQL_URL || process.env.DATABASE_URL || '');

const mysqlConfig = {
  host: process.env.MYSQL_HOST || urlConfig?.host || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || urlConfig?.port || 3306),
  user: process.env.MYSQL_USER || urlConfig?.user || 'root',
  password: process.env.MYSQL_PASSWORD ?? urlConfig?.password ?? '',
  database: process.env.MYSQL_DATABASE || urlConfig?.database || 'indiantrademart',
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 5),
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
  decimalNumbers: true,
};

let pool;

const getPool = () => {
  if (!pool) pool = mysql.createPool(mysqlConfig);
  return pool;
};

const quoteIdent = (identifier) => {
  const value = String(identifier || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Invalid SQL identifier: ${value}`);
  return `\`${value}\``;
};

const normalizeDbValue = (value) => {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Array.isArray(value) || (value && typeof value === 'object')) return JSON.stringify(value);
  return value;
};

const normalizeReturnedRow = (row) => {
  const out = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    if (Buffer.isBuffer(value)) out[key] = value.toString('utf8');
    else if (value instanceof Date) out[key] = value.toISOString();
    else out[key] = value;
  });
  return out;
};

const parseColumns = (columns = '*') => {
  const raw = String(columns || '*').replace(/\s+/g, ' ').trim();
  if (!raw || raw === '*') return '*';
  return raw
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean)
    .map(quoteIdent)
    .join(', ');
};

const parseConflictColumns = (raw = '') =>
  String(raw || '')
    .split(',')
    .map((column) => column.trim())
    .filter((column) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(column));

class ToolQuery {
  constructor(table) {
    this.table = table;
    this.operation = 'select';
    this.columns = '*';
    this.filters = [];
    this.orders = [];
    this.limitValue = null;
    this.payload = null;
    this.upsertOptions = {};
    this.returning = false;
  }

  select(columns = '*') {
    this.columns = columns || '*';
    this.returning = this.operation !== 'select';
    return this;
  }

  insert(rows) {
    this.operation = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows, options = {}) {
    this.operation = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.upsertOptions = options || {};
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  in(column, values) {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }

  order(column, options = {}) {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value) {
    this.limitValue = Math.max(0, Number(value || 0));
    return this;
  }

  async execute() {
    try {
      if (this.operation === 'select') return await this.executeSelect();
      if (this.operation === 'insert' || this.operation === 'upsert') {
        return await this.executeInsert(this.operation === 'upsert');
      }
      throw new Error(`Unsupported operation: ${this.operation}`);
    } catch (error) {
      return { data: null, error };
    }
  }

  compileWhere(params) {
    const parts = [];
    for (const filter of this.filters) {
      if (filter.op === 'eq') {
        parts.push(`${quoteIdent(filter.column)} = ?`);
        params.push(normalizeDbValue(filter.value));
      } else if (filter.op === 'in') {
        const values = Array.isArray(filter.value) ? filter.value : [];
        if (!values.length) parts.push('1 = 0');
        else {
          parts.push(`${quoteIdent(filter.column)} IN (${values.map(() => '?').join(', ')})`);
          params.push(...values.map(normalizeDbValue));
        }
      }
    }
    return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
  }

  async executeSelect() {
    const params = [];
    const where = this.compileWhere(params);
    const orderSql = this.orders.length
      ? `ORDER BY ${this.orders.map((item) => `${quoteIdent(item.column)} ${item.ascending ? 'ASC' : 'DESC'}`).join(', ')}`
      : '';
    const limitSql = this.limitValue !== null ? `LIMIT ${this.limitValue}` : '';
    const [rows] = await getPool().execute(
      `SELECT ${parseColumns(this.columns)} FROM ${quoteIdent(this.table)} ${where} ${orderSql} ${limitSql}`,
      params
    );
    return { data: rows.map(normalizeReturnedRow), error: null };
  }

  async executeInsert(isUpsert) {
    const rows = (this.payload || []).filter(Boolean);
    if (!rows.length) return { data: [], error: null };
    const allColumns = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
    if (!allColumns.includes('id')) {
      rows.forEach((row) => {
        row.id = randomUUID();
      });
      allColumns.unshift('id');
    }
    const values = rows.flatMap((row) => allColumns.map((column) => normalizeDbValue(row[column])));
    const placeholders = rows.map(() => `(${allColumns.map(() => '?').join(', ')})`).join(', ');
    const updateColumns = allColumns.filter((column) => column !== 'id');
    const updateSql = isUpsert
      ? ` ON DUPLICATE KEY UPDATE ${(updateColumns.length ? updateColumns : allColumns)
          .map((column) => `${quoteIdent(column)} = VALUES(${quoteIdent(column)})`)
          .join(', ')}`
      : '';

    await getPool().execute(
      `INSERT INTO ${quoteIdent(this.table)} (${allColumns.map(quoteIdent).join(', ')}) VALUES ${placeholders}${updateSql}`,
      values
    );

    if (!this.returning) return { data: rows, error: null };
    const conflictColumns = parseConflictColumns(this.upsertOptions?.onConflict);
    if (isUpsert && conflictColumns.length === 1) {
      return new ToolQuery(this.table).select(this.columns).in(conflictColumns[0], rows.map((row) => row[conflictColumns[0]])).execute();
    }
    return new ToolQuery(this.table).select(this.columns).in('id', rows.map((row) => row.id)).execute();
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  catch(reject) {
    return this.execute().catch(reject);
  }
}

export const db = {
  from: (table) => new ToolQuery(table),
  close: async () => {
    if (pool) await pool.end();
    pool = null;
  },
};
