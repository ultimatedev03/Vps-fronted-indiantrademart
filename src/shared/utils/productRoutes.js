const normalizeProductSlugOrId = (value = '') => String(value || '').trim();

const resolveProductSlugOrId = (productOrSlug) => {
  if (typeof productOrSlug === 'string' || typeof productOrSlug === 'number') {
    return normalizeProductSlugOrId(productOrSlug);
  }

  if (!productOrSlug || typeof productOrSlug !== 'object') return '';

  return normalizeProductSlugOrId(
    productOrSlug.slug ||
      productOrSlug.productSlug ||
      productOrSlug.productId ||
      productOrSlug.id
  );
};

export const getProductDetailPath = (productOrSlug) => {
  const slugOrId = resolveProductSlugOrId(productOrSlug);
  if (!slugOrId) return null;
  return `/product/${encodeURIComponent(slugOrId)}`;
};

export const getProductDetailUrl = (productOrSlug, origin = '') => {
  const path = getProductDetailPath(productOrSlug);
  if (!path) return '';

  const baseOrigin =
    String(origin || '').trim() ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!baseOrigin) return path;
  return `${baseOrigin.replace(/\/+$/, '')}${path}`;
};
