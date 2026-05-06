
import { supabase } from '@/lib/customSupabaseClient';
import { apiUrl } from '@/lib/apiBase';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const getReadableCsrfToken = () => {
  if (typeof document === 'undefined') return '';
  const token = document.cookie
    .split('; ')
    .find((row) => row.startsWith('itm_csrf='))
    ?.split('=')[1];
  return token ? decodeURIComponent(token) : '';
};

const shouldAttachJsonContentType = (body) => {
  if (body === undefined || body === null) return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return false;
  return true;
};

const refreshAuthContext = async () => {
  try {
    await supabase.auth.getSession();
  } catch {
    // ignore session hydration failures
  }

  try {
    await fetch(apiUrl('/api/auth/me'), {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    // ignore auth cookie refresh failures
  }
};

const shouldRetryOnce = (url, method, response) => {
  const requestUrl = String(url || '');
  if (requestUrl.includes('/api/auth/me')) return false;
  if (SAFE_METHODS.has(method)) return false;
  return response.status === 401 || response.status === 403;
};

/**
 * A wrapper around native fetch that handles httpOnly cookie auth + CSRF.
 * Automatically injects the CSRF token from cookies for mutating requests.
 */
export async function fetchWithCsrf(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const requestBody = options.body;

  const headers = {
    'Accept': 'application/json',
    ...options.headers,
  };

  if (!headers['Content-Type'] && !headers['content-type'] && shouldAttachJsonContentType(requestBody)) {
    headers['Content-Type'] = 'application/json';
  }

  if (!SAFE_METHODS.has(method) && !getReadableCsrfToken()) {
    await refreshAuthContext();
  }

  if (typeof document !== 'undefined' && !SAFE_METHODS.has(method)) {
    const csrfToken = getReadableCsrfToken();
    if (csrfToken && !headers['X-CSRF-Token']) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const executeRequest = (requestHeaders) =>
    fetch(url, {
      ...options,
      headers: requestHeaders,
      credentials: 'include',
    });

  let response = await executeRequest(headers);

  if (shouldRetryOnce(url, method, response)) {
    await refreshAuthContext();

    const retryHeaders = {
      ...headers,
    };
    const refreshedCsrfToken = getReadableCsrfToken();
    if (refreshedCsrfToken) {
      retryHeaders['X-CSRF-Token'] = refreshedCsrfToken;
    }

    response = await executeRequest(retryHeaders);
  }

  return response;
}
