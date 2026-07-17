import { apiUrl } from '@/lib/apiBase';
import {
  mapPageSeoOverride,
  normalizeSeoPath,
  readEmbeddedPageSeoOverride,
} from '@/modules/directory/seo/pageSeoOverrides';

const requestCache = new Map();

export const loadPageSeoOverride = async (pathname) => {
  const path = normalizeSeoPath(pathname);
  if (requestCache.has(path)) return requestCache.get(path);

  const request = (async () => {
    try {
      const response = await fetch(apiUrl(`/api/public/page-seo?path=${encodeURIComponent(path)}`), {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`SEO metadata request failed with HTTP ${response.status}`);
      const payload = await response.json();
      return mapPageSeoOverride(payload?.seo);
    } catch (error) {
      console.warn('[pageSeo] DB metadata unavailable:', error?.message || error);
      return readEmbeddedPageSeoOverride(path);
    }
  })();

  requestCache.set(path, request);
  return request;
};

export const getInitialPageSeoOverride = (pathname) => readEmbeddedPageSeoOverride(pathname);
