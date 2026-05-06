const STORAGE_KEY = 'itm:favorite-products:v1';
export const PRODUCT_FAVORITES_UPDATED_EVENT = 'itm:favorite-products:updated';

const normalizeUserKey = (userId) => String(userId || '').trim() || 'anonymous';

const readStore = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (store) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store || {}));
  window.dispatchEvent(new CustomEvent(PRODUCT_FAVORITES_UPDATED_EVENT));
};

const parsePrice = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value).replace(/[^0-9.]/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

const normalizeFavoriteProduct = (item = {}) => {
  const productId = String(item.productId || item.id || '').trim();
  if (!productId) return null;

  const slug = String(item.slug || productId).trim();
  const imageFromArray = Array.isArray(item.images) ? item.images.find(Boolean) : null;
  const image = imageFromArray || item.image || '';
  const vendorId = item.vendorId || item.vendor_id || item.vendors?.id || null;
  const vendorSlug = item.vendorSlug || item.vendors?.slug || '';
  const vendorName = item.vendorName || item.vendors?.company_name || '';
  const vendorCity = item.vendorCity || item.vendors?.city || '';
  const vendorState = item.vendorState || item.vendors?.state || '';
  const priceValue = parsePrice(item.price);

  return {
    productId,
    slug,
    name: String(item.name || 'Service').trim(),
    price: item.price ?? null,
    priceValue,
    image,
    vendorId,
    vendorSlug,
    vendorName,
    vendorCity,
    vendorState,
    created_at: item.created_at || new Date().toISOString(),
  };
};

const getList = (store, userId) => {
  const list = store?.[normalizeUserKey(userId)];
  return Array.isArray(list) ? list : [];
};

export const productFavorites = {
  list(userId) {
    const store = readStore();
    return getList(store, userId).slice().sort((a, b) => {
      const at = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });
  },

  isFavorite(userId, productId) {
    const key = String(productId || '').trim();
    if (!key) return false;
    return this.list(userId).some((item) => String(item?.productId || '').trim() === key);
  },

  toggle(userId, productLike) {
    const normalized = normalizeFavoriteProduct(productLike);
    if (!normalized) return { isFavorite: false, items: this.list(userId) };

    const store = readStore();
    const userKey = normalizeUserKey(userId);
    const current = getList(store, userId);
    const exists = current.some((item) => String(item?.productId || '').trim() === normalized.productId);

    const next = exists
      ? current.filter((item) => String(item?.productId || '').trim() !== normalized.productId)
      : [{ ...normalized }, ...current];

    store[userKey] = next;
    writeStore(store);

    return { isFavorite: !exists, items: this.list(userId) };
  },

  remove(userId, productId) {
    const key = String(productId || '').trim();
    if (!key) return this.list(userId);

    const store = readStore();
    const userKey = normalizeUserKey(userId);
    const current = getList(store, userId);
    store[userKey] = current.filter((item) => String(item?.productId || '').trim() !== key);
    writeStore(store);
    return this.list(userId);
  },
};
