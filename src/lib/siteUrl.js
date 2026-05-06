const FALLBACK_SITE_URL = 'https://indiantrademart.com';

const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

export const getSiteUrl = () => {
  const raw = trimTrailingSlash(import.meta.env.VITE_SITE_URL || '');
  if (!raw) return FALLBACK_SITE_URL;

  try {
    return trimTrailingSlash(new URL(raw).toString());
  } catch {
    return raw;
  }
};

export const toAbsoluteSiteUrl = (path = '/') => {
  const base = getSiteUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};
