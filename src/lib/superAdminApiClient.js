let superAdminToken = null;

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
  return superAdminToken;
}

export function setSuperAdminToken(token) {
  superAdminToken = token || null;
}

export function clearSuperAdminSession() {
  superAdminToken = null;
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
