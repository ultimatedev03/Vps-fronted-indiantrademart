const STORAGE_KEY = 'itm:product-ratings:v1';
export const PRODUCT_RATINGS_UPDATED_EVENT = 'itm:product-ratings:updated';

const normalizeProductId = (value) => String(value || '').trim();
const normalizeUserId = (value) => String(value || '').trim() || 'guest';

const clampRating = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, Math.round(n)));
};

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
  window.dispatchEvent(new CustomEvent(PRODUCT_RATINGS_UPDATED_EVENT));
};

const getBucket = (store, productId) => {
  const key = normalizeProductId(productId);
  if (!key) return {};
  const bucket = store?.[key];
  return bucket && typeof bucket === 'object' ? bucket : {};
};

const toEntries = (bucket = {}) =>
  Object.values(bucket)
    .filter((row) => {
      const rating = clampRating(row?.rating);
      return rating >= 1 && rating <= 5;
    })
    .map((row) => ({
      userId: normalizeUserId(row?.userId),
      buyerName: String(row?.buyerName || '').trim(),
      rating: clampRating(row?.rating),
      feedback: String(row?.feedback || '').trim(),
      created_at: row?.created_at || row?.updated_at || null,
      updated_at: row?.updated_at || null,
    }))
    .sort((a, b) => {
      const at = a?.updated_at || a?.created_at ? new Date(a.updated_at || a.created_at).getTime() : 0;
      const bt = b?.updated_at || b?.created_at ? new Date(b.updated_at || b.created_at).getTime() : 0;
      return bt - at;
    });

const summarize = (entries = []) => {
  const list = Array.isArray(entries) ? entries : [];
  const count = list.length;
  if (!count) return { average: 0, count: 0 };
  const sum = list.reduce((acc, item) => acc + clampRating(item?.rating), 0);
  const average = Math.round((sum / count) * 10) / 10;
  return { average, count };
};

export const productRatings = {
  getProductRatings(productId) {
    const store = readStore();
    const bucket = getBucket(store, productId);
    return toEntries(bucket);
  },

  getProductSummary(productId) {
    return summarize(this.getProductRatings(productId));
  },

  getSummaryMap(productIds = []) {
    const ids = Array.isArray(productIds) ? productIds : [];
    const out = {};
    ids.forEach((id) => {
      const key = normalizeProductId(id);
      if (!key) return;
      out[key] = this.getProductSummary(key);
    });
    return out;
  },

  getUserRating(productId, userId) {
    const pid = normalizeProductId(productId);
    const uid = normalizeUserId(userId);
    if (!pid || !uid) return null;

    const store = readStore();
    const bucket = getBucket(store, pid);
    const row = bucket?.[uid];
    if (!row) return null;
    const rating = clampRating(row?.rating);
    if (!rating) return null;

    return {
      userId: uid,
      buyerName: String(row?.buyerName || '').trim(),
      rating,
      feedback: String(row?.feedback || '').trim(),
      created_at: row?.created_at || row?.updated_at || null,
      updated_at: row?.updated_at || null,
    };
  },

  upsertRating({ productId, userId, rating, feedback = '', buyerName = '' }) {
    const pid = normalizeProductId(productId);
    const uid = normalizeUserId(userId);
    const safeRating = clampRating(rating);

    if (!pid) throw new Error('Invalid product id');
    if (!uid || uid === 'guest') throw new Error('Please login to rate');
    if (!safeRating) throw new Error('Please select a star rating');

    const store = readStore();
    const bucket = getBucket(store, pid);
    const existingEntry = bucket?.[uid];
    const createdAt = existingEntry?.created_at || existingEntry?.updated_at || new Date().toISOString();

    const nextEntry = {
      userId: uid,
      buyerName: String(buyerName || '').trim().slice(0, 120),
      rating: safeRating,
      feedback: String(feedback || '').trim().slice(0, 1000),
      created_at: createdAt,
      updated_at: new Date().toISOString(),
    };

    store[pid] = {
      ...bucket,
      [uid]: nextEntry,
    };
    writeStore(store);

    return {
      entry: nextEntry,
      summary: this.getProductSummary(pid),
    };
  },

  deleteRating({ productId, userId }) {
    const pid = normalizeProductId(productId);
    const uid = normalizeUserId(userId);

    if (!pid) throw new Error('Invalid product id');
    if (!uid || uid === 'guest') throw new Error('Please login to manage rating');

    const store = readStore();
    const bucket = getBucket(store, pid);
    if (!bucket?.[uid]) {
      return {
        removed: false,
        summary: this.getProductSummary(pid),
      };
    }

    const nextBucket = { ...bucket };
    delete nextBucket[uid];

    if (Object.keys(nextBucket).length > 0) {
      store[pid] = nextBucket;
    } else {
      delete store[pid];
    }

    writeStore(store);

    return {
      removed: true,
      summary: this.getProductSummary(pid),
    };
  },
};
