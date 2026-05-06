const normalizeVendorSlugOrId = (value = '') => String(value || '').trim();

const resolveVendorSlugOrId = (vendorOrSlug) => {
  if (typeof vendorOrSlug === 'string' || typeof vendorOrSlug === 'number') {
    return normalizeVendorSlugOrId(vendorOrSlug);
  }

  if (!vendorOrSlug || typeof vendorOrSlug !== 'object') return '';

  return normalizeVendorSlugOrId(
    vendorOrSlug.slug ||
      vendorOrSlug.vendorSlug ||
      vendorOrSlug.vendor_id ||
      vendorOrSlug.vendorId ||
      vendorOrSlug.id
  );
};

export const getVendorProfilePath = (vendorOrSlug) => {
  const slugOrId = resolveVendorSlugOrId(vendorOrSlug);
  if (!slugOrId) return null;
  return `/directory/vendor/${encodeURIComponent(slugOrId)}`;
};

export const getVendorProfileUrl = (vendorOrSlug, origin = '') => {
  const path = getVendorProfilePath(vendorOrSlug);
  if (!path) return '';

  const baseOrigin =
    String(origin || '').trim() ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!baseOrigin) return path;
  return `${baseOrigin.replace(/\/+$/, '')}${path}`;
};
