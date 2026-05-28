import { apiUrl } from '@/lib/apiBase';

let cachedUser = null;
let cachedBackendAccessToken = '';
let refreshPromise = null;
let lastRefreshAt = 0;
let refreshCooldownUntil = 0;
const listeners = new Set();
const AUTH_SYNC_STORAGE_KEY = 'itm_auth_sync_v1';
let authSyncBound = false;

const SESSION_TTL_MS = 30 * 1000;
const REFRESH_COOLDOWN_MS = 15 * 1000;
const BUYER_NOT_REGISTERED_MESSAGE = 'This email is not registered as buyer';

const normalizeRole = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'DATAENTRY') return 'DATA_ENTRY';
  if (raw === 'FINACE') return 'FINANCE';
  return raw;
};

const getRoleMismatchMessage = (requestedRole) => {
  const normalized = normalizeRole(requestedRole);
  if (normalized === 'BUYER') return BUYER_NOT_REGISTERED_MESSAGE;
  if (normalized === 'VENDOR') return 'This email is not registered as vendor';
  if (!normalized) return 'Access denied';
  return `This email is not registered as ${normalized.toLowerCase()}`;
};

const getCaptchaField = (source = {}, ...keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const getCsrfToken = () => {
  if (typeof document === 'undefined') return '';
  const token = document.cookie
    .split('; ')
    .find((row) => row.startsWith('itm_csrf='))
    ?.split('=')[1];
  return token ? decodeURIComponent(token) : '';
};

const hasReadableAuthSessionHint = () => Boolean(getCsrfToken());

const emit = (event, session) => {
  listeners.forEach((cb) => {
    try {
      cb(event, session);
    } catch {
      // Ignore listener errors.
    }
  });
};

const resetCachedAuth = () => {
  cachedUser = null;
  cachedBackendAccessToken = '';
  lastRefreshAt = 0;
  refreshCooldownUntil = 0;
};

const setCachedBackendAccessToken = (value) => {
  cachedBackendAccessToken = String(value || '').trim();
};

const broadcastAuthSync = (event) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify({ event, ts: Date.now() }));
  } catch {
    // Ignore storage sync errors.
  }
};

const fetchJson = async (path, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (
    options.body !== undefined &&
    options.body !== null &&
    !headers['Content-Type'] &&
    !headers['content-type']
  ) {
    headers['Content-Type'] = 'application/json';
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf && !headers['X-CSRF-Token']) headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error || data?.message || 'Request failed');
    error.status = res.status;
    error.payload = data;
    throw error;
  }
  return data;
};

const sanitizeAuthUser = (user) => {
  if (!user || typeof user !== 'object') return null;
  const next = { ...user };
  delete next.access_token;
  return next;
};

const buildSession = (user) =>
  user
    ? {
        user,
        access_token: null,
        backend_access_token: cachedBackendAccessToken || null,
      }
    : null;

const refreshSession = async (force = false) => {
  const now = Date.now();
  if (!force) {
    if (!cachedUser && !hasReadableAuthSessionHint()) return buildSession(null);
    if (refreshCooldownUntil && now < refreshCooldownUntil) return buildSession(cachedUser);
    if (cachedUser && now - lastRefreshAt < SESSION_TTL_MS) return buildSession(cachedUser);
  }

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const hadUser = !!cachedUser;
    try {
      const data = await fetchJson('/api/auth/me');
      setCachedBackendAccessToken(data?.user?.access_token);
      cachedUser = sanitizeAuthUser(data?.user || null);
      lastRefreshAt = Date.now();
      return buildSession(cachedUser);
    } catch (error) {
      if (error?.status === 429) refreshCooldownUntil = Date.now() + REFRESH_COOLDOWN_MS;
      if (!hadUser) {
        cachedUser = null;
        setCachedBackendAccessToken('');
      }
      return buildSession(cachedUser);
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const ensureAuthSyncListener = () => {
  if (authSyncBound || typeof window === 'undefined') return;
  authSyncBound = true;
  window.addEventListener('storage', (event) => {
    if (event?.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
    let payload = null;
    try {
      payload = JSON.parse(event.newValue);
    } catch {
      payload = null;
    }
    const syncedEvent = String(payload?.event || '').toUpperCase();
    if (!syncedEvent) return;
    if (syncedEvent === 'SIGNED_OUT') {
      resetCachedAuth();
      emit('SIGNED_OUT', null);
      return;
    }
    refreshCooldownUntil = 0;
    lastRefreshAt = 0;
    refreshSession(true)
      .then((session) => emit('TOKEN_REFRESHED', session))
      .catch(() => {});
  });
};

ensureAuthSyncListener();

const normalizeFilterOperator = (operator = 'eq') => {
  const op = String(operator || 'eq').trim().toLowerCase();
  if (op === 'cs') return 'contains';
  if (op === 'not.eq') return 'neq';
  if (op.startsWith('not.')) return negateFilterOperator(op.slice(4));
  return op;
};

const negateFilterOperator = (operator = 'eq') => {
  const op = normalizeFilterOperator(operator);
  if (op === 'eq') return 'neq';
  if (op === 'neq') return 'eq';
  if (op === 'in') return 'notin';
  if (op === 'is') return 'notis';
  if (op.startsWith('not')) return op;
  return `not${op}`;
};

class MysqlBrowserQuery {
  constructor(table) {
    this.table = table;
    this.operation = 'select';
    this.payload = null;
    this.selectColumns = '*';
    this.selectOptions = {};
    this.filters = [];
    this.orGroups = [];
    this.orders = [];
    this.limitValue = null;
    this.offsetValue = null;
    this.singleMode = false;
    this.maybeSingleMode = false;
    this.upsertOptions = {};
    this.shouldThrow = false;
  }

  select(columns = '*', options = {}) {
    this.selectColumns = columns || '*';
    this.selectOptions = options || {};
    return this;
  }

  insert(rows) {
    this.operation = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(values) {
    this.operation = 'update';
    this.payload = values || {};
    return this;
  }

  upsert(rows, options = {}) {
    this.operation = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.upsertOptions = options || {};
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column, value) { this.filters.push({ column, op: 'eq', value }); return this; }
  neq(column, value) { this.filters.push({ column, op: 'neq', value }); return this; }
  gt(column, value) { this.filters.push({ column, op: 'gt', value }); return this; }
  gte(column, value) { this.filters.push({ column, op: 'gte', value }); return this; }
  lt(column, value) { this.filters.push({ column, op: 'lt', value }); return this; }
  lte(column, value) { this.filters.push({ column, op: 'lte', value }); return this; }
  like(column, value) { this.filters.push({ column, op: 'like', value }); return this; }
  ilike(column, value) { this.filters.push({ column, op: 'ilike', value }); return this; }
  in(column, value) { this.filters.push({ column, op: 'in', value }); return this; }
  is(column, value) { this.filters.push({ column, op: 'is', value }); return this; }
  contains(column, value) { this.filters.push({ column, op: 'contains', value }); return this; }
  filter(column, operator, value) { this.filters.push({ column, op: normalizeFilterOperator(operator), value }); return this; }
  not(column, operator, value) { this.filters.push({ column, op: negateFilterOperator(operator), value }); return this; }
  or(filterString) { this.orGroups.push(String(filterString || '')); return this; }
  match(values = {}) {
    Object.entries(values || {}).forEach(([column, value]) => this.eq(column, value));
    return this;
  }

  order(column, options = {}) {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value) {
    this.limitValue = Number(value || 0);
    return this;
  }

  range(from, to) {
    const start = Math.max(0, Number(from || 0));
    const end = Math.max(start, Number(to || start));
    this.offsetValue = start;
    this.limitValue = end - start + 1;
    return this;
  }

  single() {
    this.singleMode = true;
    this.limitValue = this.limitValue || 1;
    return this;
  }

  maybeSingle() {
    this.maybeSingleMode = true;
    this.limitValue = this.limitValue || 1;
    return this;
  }

  returns() {
    return this;
  }

  throwOnError() {
    this.shouldThrow = true;
    return this;
  }

  async execute() {
    try {
      const data = await fetchJson('/api/db/query', {
        method: 'POST',
        body: JSON.stringify({
          table: this.table,
          operation: this.operation,
          payload: this.payload,
          selectColumns: this.selectColumns,
          selectOptions: this.selectOptions,
          filters: this.filters,
          orGroups: this.orGroups,
          orders: this.orders,
          limitValue: this.limitValue,
          offsetValue: this.offsetValue,
          singleMode: this.singleMode,
          maybeSingleMode: this.maybeSingleMode,
          upsertOptions: this.upsertOptions,
        }),
      });
      return { data: data?.data ?? null, error: null, count: data?.count ?? null };
    } catch (error) {
      if (this.shouldThrow) throw error;
      return { data: null, error, count: null };
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  catch(reject) {
    return this.execute().catch(reject);
  }
}

const auth = {
  getSession: async () => {
    const session = await refreshSession();
    return { data: { session }, error: null };
  },
  getUser: async () => {
    if (!cachedUser) await refreshSession();
    return { data: { user: cachedUser }, error: null };
  },
  signInWithPassword: async ({
    email,
    password,
    options = {},
    role,
    role_hint,
    roleHint,
    captcha_token,
    captchaToken,
    captcha_action,
    captchaAction,
    turnstile_token,
    turnstileToken,
  } = {}) => {
    try {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const roleFromOptions = options?.data?.role || options?.role;
      const roleValue = role || role_hint || roleHint || roleFromOptions || null;
      const requestedRole = normalizeRole(roleValue);
      const captchaTokenValue =
        getCaptchaField(options?.data, 'captcha_token', 'captchaToken', 'turnstile_token', 'turnstileToken') ||
        getCaptchaField(
          {
            captcha_token,
            captchaToken,
            turnstile_token,
            turnstileToken,
            optionsCaptchaToken: options?.captcha_token,
          },
          'captcha_token',
          'captchaToken',
          'turnstile_token',
          'turnstileToken',
          'optionsCaptchaToken'
        );
      const captchaActionValue =
        getCaptchaField(options?.data, 'captcha_action', 'captchaAction') ||
        getCaptchaField(
          {
            captcha_action,
            captchaAction,
            optionsCaptchaAction: options?.captcha_action,
          },
          'captcha_action',
          'captchaAction',
          'optionsCaptchaAction'
        );

      const data = await fetchJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          ...(roleValue ? { role: roleValue } : {}),
          ...(captchaTokenValue ? { captcha_token: captchaTokenValue } : {}),
          ...(captchaActionValue ? { captcha_action: captchaActionValue } : {}),
        }),
      });
      setCachedBackendAccessToken(data?.user?.access_token);
      const returnedUser = sanitizeAuthUser(data?.user || null);
      const returnedRole = normalizeRole(
        returnedUser?.role || returnedUser?.app_metadata?.role || returnedUser?.user_metadata?.role
      );

      if (requestedRole && requestedRole !== returnedRole) {
        await fetchJson('/api/auth/logout', { method: 'POST' }).catch(() => {});
        resetCachedAuth();
        const error = new Error(getRoleMismatchMessage(requestedRole));
        error.status = 403;
        return { data: { user: null, session: null }, error };
      }

      cachedUser = returnedUser;
      lastRefreshAt = Date.now();
      refreshCooldownUntil = 0;
      const session = buildSession(cachedUser);
      emit('SIGNED_IN', session);
      broadcastAuthSync('SIGNED_IN');
      return { data: { user: cachedUser, session }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error };
    }
  },
  signUp: async ({ email, password, options = {} } = {}) => {
    try {
      const meta = options?.data || {};
      const captchaToken = getCaptchaField(meta, 'captcha_token', 'captchaToken');
      const captchaAction = getCaptchaField(meta, 'captcha_action', 'captchaAction');
      const data = await fetchJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          ...meta,
          full_name: meta?.full_name || meta?.fullName,
          role: meta?.role,
          phone: meta?.phone || meta?.mobile_number || meta?.mobileNumber,
          ...(captchaToken ? { captcha_token: captchaToken } : {}),
          ...(captchaAction ? { captcha_action: captchaAction } : {}),
        }),
      });
      setCachedBackendAccessToken(data?.user?.access_token);
      cachedUser = sanitizeAuthUser(data?.user || null);
      lastRefreshAt = Date.now();
      refreshCooldownUntil = 0;
      const session = buildSession(cachedUser);
      emit('SIGNED_IN', session);
      broadcastAuthSync('SIGNED_IN');
      return { data: { user: cachedUser, session }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error };
    }
  },
  signOut: async () => {
    await fetchJson('/api/auth/logout', { method: 'POST' }).catch(() => {});
    resetCachedAuth();
    emit('SIGNED_OUT', null);
    broadcastAuthSync('SIGNED_OUT');
    return { error: null };
  },
  updateUser: async ({ password } = {}) => {
    try {
      if (password) {
        await fetchJson('/api/auth/password', {
          method: 'PATCH',
          body: JSON.stringify({ new_password: password }),
        });
      }
      if (!cachedUser) await refreshSession();
      return { data: { user: cachedUser }, error: null };
    } catch (error) {
      return { data: { user: cachedUser }, error };
    }
  },
  setSession: async () => {
    const session = await refreshSession(true);
    emit('TOKEN_REFRESHED', session);
    return { data: { session }, error: null };
  },
  onAuthStateChange: (callback) => {
    listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(callback),
        },
      },
    };
  },
};

const parseRealtimeFilter = (raw = '') => {
  const [column, expression] = String(raw || '').split('=');
  if (!column || !expression) return null;
  const [op, ...rest] = expression.split('.');
  const value = rest.join('.');
  return { column, op, value };
};

const applyRealtimeFilter = (query, filter) => {
  const parsed = parseRealtimeFilter(filter?.filter);
  if (!parsed) return query;
  if (parsed.op === 'eq') return query.eq(parsed.column, parsed.value);
  if (parsed.op === 'in') {
    const values = String(parsed.value || '')
      .replace(/^\(|\)$/g, '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return query.in(parsed.column, values);
  }
  return query;
};

const getPollIntervalMs = () => {
  const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_DB_POLL_MS : '';
  const value = Number(raw || 5000);
  return Number.isFinite(value) ? Math.max(2000, value) : 5000;
};

const makeChannel = () => {
  const handlers = [];
  let timer = null;
  let initialized = false;
  let lastSnapshot = new Map();
  let polling = false;

  const stopPolling = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      const nextSnapshot = new Map();
      for (const handler of handlers) {
        if (handler.eventType !== 'postgres_changes' || !handler.filter?.table) continue;
        let query = dbClient.from(handler.filter.table).select('*').limit(200);
        query = applyRealtimeFilter(query, handler.filter);
        const { data, error } = await query;
        if (error || !Array.isArray(data)) continue;

        data.forEach((row) => {
          const key = `${handler.filter.table}:${row?.id || JSON.stringify(row)}`;
          const encoded = JSON.stringify(row || {});
          nextSnapshot.set(key, encoded);
          if (!initialized) return;
          const previous = lastSnapshot.get(key);
          if (previous !== encoded) {
            handler.callback({
              eventType: previous ? 'UPDATE' : 'INSERT',
              schema: handler.filter.schema || 'public',
              table: handler.filter.table,
              new: row,
              old: previous ? JSON.parse(previous) : null,
            });
          }
        });
      }
      lastSnapshot = nextSnapshot;
      initialized = true;
    } catch {
      // Polling is best-effort; regular page fetches remain the source of truth.
    } finally {
      polling = false;
    }
  };

  const channel = {
    on: (eventType, filter, callback) => {
      if (typeof callback === 'function') handlers.push({ eventType, filter: filter || {}, callback });
      return channel;
    },
    track: () => Promise.resolve('ok'),
    untrack: () => Promise.resolve('ok'),
    presenceState: () => ({}),
    subscribe: (callback) => {
      if (typeof callback === 'function') {
        setTimeout(() => callback('SUBSCRIBED'), 0);
      }
      if (!timer && handlers.some((handler) => handler.eventType === 'postgres_changes')) {
        poll();
        timer = setInterval(poll, getPollIntervalMs());
      }
      return channel;
    },
    unsubscribe: () => {
      stopPolling();
      return Promise.resolve('ok');
    },
  };
  return channel;
};

const dbClient = {
  auth,
  from: (table) => new MysqlBrowserQuery(table),
  rpc: async () => ({ data: null, error: new Error('RPC is not exposed to the browser') }),
  functions: {
    invoke: async (name, options = {}) => {
      try {
        const data = await fetchJson(`/api/functions/${encodeURIComponent(String(name || ''))}`, {
          method: 'POST',
          body: JSON.stringify(options?.body || {}),
        });
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },
  channel: () => makeChannel(),
  removeChannel: (channel) => channel?.unsubscribe?.() || Promise.resolve('ok'),
};

export default dbClient;
export { dbClient };
