let superAdminToken = null;

const LEGACY_TOKEN_KEY = 'itm_superadmin_token';
const SESSION_TOKEN_KEY = 'itm_superadmin_session_token';

function isLocalDevHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function joinBaseAndPath(base, path) {
  if (path.startsWith('http')) return path;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function getSuperAdminToken() {
  if (superAdminToken) return superAdminToken;
  if (typeof window === 'undefined') return null;

  try {
    const sessionToken = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
    const localToken = window.localStorage.getItem(LEGACY_TOKEN_KEY);
    superAdminToken = sessionToken || localToken || null;
  } catch {
    superAdminToken = null;
  }

  return superAdminToken;
}

export function setSuperAdminToken(token) {
  superAdminToken = token || null;
  if (typeof window === 'undefined') return;

  try {
    if (superAdminToken) {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, superAdminToken);
      window.localStorage.setItem(LEGACY_TOKEN_KEY, superAdminToken);
    } else {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
  } catch {
    // Storage can be unavailable in private/hardened contexts; memory fallback still works.
  }
}

export function clearSuperAdminSession() {
  superAdminToken = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    window.localStorage.removeItem(SUPERADMIN_KEYS.session);
  } catch {
    // ignore storage cleanup failures
  }
}

export function getSuperAdminBase() {
  const override = import.meta.env.VITE_SUPERADMIN_API_BASE;
  if (override && String(override).trim()) {
    const normalized = String(override).trim();
    if (!import.meta.env.DEV) {
      try {
        const parsed = new URL(normalized);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1') {
          return '/api/superadmin';
        }
      } catch {
        // Ignore invalid override URLs and fall back below.
      }
    }
    return normalized;
  }
  return '/api/superadmin';
}

export async function superAdminFetch(path, options = {}) {
  const token = getSuperAdminToken();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const base = getSuperAdminBase();
  const url = joinBaseAndPath(base, path);

  const requestConfig = {
    cache: 'no-store',
    credentials: 'include',
    ...options,
    headers,
  };

  let response = await fetch(url, requestConfig);

  // Local fallback: helpful when frontend runs on :3000 without Vite /api proxy.
  if (
    !path.startsWith('http') &&
    response.status === 404 &&
    isLocalDevHost() &&
    import.meta.env.DEV &&
    !import.meta.env.VITE_SUPERADMIN_API_BASE
  ) {
    const fallbackBase = 'http://localhost:3001/api/superadmin';
    const fallbackUrl = joinBaseAndPath(fallbackBase, path);
    response = await fetch(fallbackUrl, requestConfig);
  }

  return response;
}

export const SUPERADMIN_KEYS = {
  token: 'itm_superadmin_token',
  session: 'itm_superadmin_session',
};
