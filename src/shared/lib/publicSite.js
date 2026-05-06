const INTERNAL_SUBDOMAINS = new Set([
  'admin',
  'buyer',
  'career',
  'dir',
  'emp',
  'finance',
  'hr',
  'man',
  'management',
  'vendor',
]);

export const getPublicSiteUrl = (locationLike) => {
  const locationObject =
    locationLike ||
    (typeof window !== 'undefined' ? window.location : null);

  if (!locationObject) return '/';

  const protocol = locationObject.protocol || 'http:';
  const hostname = String(locationObject.hostname || '').trim();
  const port = String(locationObject.port || '').trim();

  if (!hostname) return '/';

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  ) {
    return `${protocol}//${hostname}${port ? `:${port}` : ''}/`;
  }

  const parts = hostname.split('.').filter(Boolean);
  const rootHost =
    parts.length >= 3 && INTERNAL_SUBDOMAINS.has(parts[0])
      ? parts.slice(1).join('.')
      : hostname;

  return `${protocol}//${rootHost}${port ? `:${port}` : ''}/`;
};
