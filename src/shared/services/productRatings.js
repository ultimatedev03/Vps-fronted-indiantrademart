import { apiUrl } from '@/lib/apiBase';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

const STORAGE_KEY = 'itm:product-ratings:v1';
export const PRODUCT_RATINGS_UPDATED_EVENT = 'itm:product-ratings:updated';

const normalizeProductId = (value) => String(value || '').trim();
const normalizeUserId = (value) => String(value || '').trim() || 'guest';

const normalizeUserIds = (userIds = []) => {
  const values = Array.isArray(userIds) ? userIds : [userIds];
  return Array.from(
    new Set(
      values
        .map(normalizeUserId)
        .filter((key) => key && key !== 'guest')
    )
  );
};

const clampRating = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, Math.round(n)));
};

const emitUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PRODUCT_RATINGS_UPDATED_EVENT));
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
  emitUpdated();
};

const getBucket = (store, productId) => {
  const key = normalizeProductId(productId);
  if (!key) return {};
  const bucket = store?.[key];
  return bucket && typeof bucket === 'object' ? bucket : {};
};

const normalizeEntry = (row = {}) => ({
  userId: normalizeUserId(row?.userId || row?.buyer_id || row?.buyerId),
  buyerName: String(row?.buyerName || row?.buyer_name || '').trim(),
  rating: clampRating(row?.rating),
  feedback: String(row?.feedback || row?.comment || '').trim(),
  created_at: row?.created_at || row?.updated_at || null,
  updated_at: row?.updated_at || row?.created_at || null,
});

const toEntries = (bucket = {}) =>
  Object.values(bucket)
    .map(normalizeEntry)
    .filter((row) => row.rating >= 1 && row.rating <= 5)
    .sort((a, b) => {
      const at = a?.updated_at || a?.created_at ? new Date(a.updated_at || a.created_at).getTime() : 0;
      const bt = b?.updated_at || b?.created_at ? new Date(b.updated_at || b.created_at).getTime() : 0;
      return bt - at;
    });

const summarize = (entries = []) => {
  const list = Array.isArray(entries) ? entries.filter((row) => clampRating(row?.rating)) : [];
  const count = list.length;
  if (!count) return { average: 0, count: 0 };
  const sum = list.reduce((acc, item) => acc + clampRating(item?.rating), 0);
  const average = Math.round((sum / count) * 10) / 10;
  return { average, count };
};

const getLocalProductRatings = (productId) => {
  const store = readStore();
  return toEntries(getBucket(store, productId));
};

const getLocalProductSummary = (productId) => summarize(getLocalProductRatings(productId));

const getLocalUserRatingForKeys = (productId, userIds = []) => {
  const pid = normalizeProductId(productId);
  const keys = normalizeUserIds(userIds);
  if (!pid || !keys.length) return null;

  const bucket = getBucket(readStore(), pid);
  return keys
    .map((uid) => {
      const row = bucket?.[uid];
      return row ? normalizeEntry({ ...row, userId: uid }) : null;
    })
    .filter((row) => row?.rating)
    .sort((a, b) => {
      const at = a?.updated_at || a?.created_at ? new Date(a.updated_at || a.created_at).getTime() : 0;
      const bt = b?.updated_at || b?.created_at ? new Date(b.updated_at || b.created_at).getTime() : 0;
      return bt - at;
    })[0] || null;
};

const mapServerState = (json = {}) => {
  const ratings = Array.isArray(json?.ratings) ? json.ratings.map(normalizeEntry).filter((row) => row.rating) : [];
  const summary = json?.summary && typeof json.summary === 'object' ? json.summary : summarize(ratings);
  const myRating = json?.myRating ? normalizeEntry(json.myRating) : null;

  return {
    summary,
    ratings,
    myRating: myRating?.rating ? myRating : null,
  };
};

const fetchRatingState = async (productId) => {
  const pid = normalizeProductId(productId);
  if (!pid) throw new Error('Invalid product id');

  const res = await fetchWithCsrf(apiUrl(`/api/dir/products/${encodeURIComponent(pid)}/ratings`));
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Failed to load ratings');
  return mapServerState(json);
};

export const productRatings = {
  async getProductRatingState(productId, userIds = []) {
    const pid = normalizeProductId(productId);
    if (!pid) return { summary: { average: 0, count: 0 }, ratings: [], myRating: null };

    try {
      return await fetchRatingState(pid);
    } catch (error) {
      const ratings = getLocalProductRatings(pid);
      return {
        summary: summarize(ratings),
        ratings,
        myRating: getLocalUserRatingForKeys(pid, userIds),
      };
    }
  },

  async getProductRatings(productId) {
    return (await this.getProductRatingState(productId)).ratings;
  },

  async getProductSummary(productId) {
    return (await this.getProductRatingState(productId)).summary;
  },

  async getSummaryMap(productIds = []) {
    const ids = Array.from(
      new Set(
        (Array.isArray(productIds) ? productIds : [])
          .map(normalizeProductId)
          .filter(Boolean)
      )
    );

    if (!ids.length) return {};

    try {
      const res = await fetch(apiUrl('/api/dir/products/ratings/summary'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ productIds: ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load rating summaries');
      return json?.summaries || {};
    } catch {
      const out = {};
      ids.forEach((id) => {
        out[id] = getLocalProductSummary(id);
      });
      return out;
    }
  },

  async getUserRatingForKeys(productId, userIds = []) {
    return (await this.getProductRatingState(productId, userIds)).myRating;
  },

  async upsertRatingForKeys({ productId, primaryUserId, userIds = [], rating, feedback = '', buyerName = '' }) {
    const pid = normalizeProductId(productId);
    const keys = normalizeUserIds([primaryUserId, ...(Array.isArray(userIds) ? userIds : [userIds])]);
    const safeRating = clampRating(rating);

    if (!pid) throw new Error('Invalid product id');
    if (!keys.length) throw new Error('Please login to rate');
    if (!safeRating) throw new Error('Please select a star rating');

    const res = await fetchWithCsrf(apiUrl(`/api/dir/products/${encodeURIComponent(pid)}/ratings`), {
      method: 'POST',
      body: JSON.stringify({
        rating: safeRating,
        feedback: String(feedback || '').trim().slice(0, 1000),
        buyerName: String(buyerName || '').trim().slice(0, 120),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Could not save your rating');

    emitUpdated();
    return {
      entry: normalizeEntry(json?.entry || json?.myRating || {}),
      summary: json?.summary || { average: 0, count: 0 },
      ratings: Array.isArray(json?.ratings) ? json.ratings.map(normalizeEntry) : [],
    };
  },

  async deleteRatingForKeys({ productId, userIds = [] }) {
    const pid = normalizeProductId(productId);
    const keys = normalizeUserIds(userIds);

    if (!pid) throw new Error('Invalid product id');
    if (!keys.length) throw new Error('Please login to manage rating');

    const res = await fetchWithCsrf(apiUrl(`/api/dir/products/${encodeURIComponent(pid)}/ratings`), {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Could not delete your rating');

    emitUpdated();
    return {
      removed: Boolean(json?.removed),
      summary: json?.summary || { average: 0, count: 0 },
      ratings: Array.isArray(json?.ratings) ? json.ratings.map(normalizeEntry) : [],
    };
  },

  // Kept for one-time fallback/old browser data compatibility.
  upsertLocalRatingForKeys({ productId, primaryUserId, userIds = [], rating, feedback = '', buyerName = '' }) {
    const pid = normalizeProductId(productId);
    const keys = normalizeUserIds([primaryUserId, ...(Array.isArray(userIds) ? userIds : [userIds])]);
    const safeRating = clampRating(rating);

    if (!pid || !keys.length || !safeRating) return null;

    const store = readStore();
    const bucket = getBucket(store, pid);
    const existingEntry = keys.map((key) => bucket?.[key]).find(Boolean);
    const createdAt = existingEntry?.created_at || existingEntry?.updated_at || new Date().toISOString();
    const updatedAt = new Date().toISOString();
    const nextBucket = { ...bucket };

    keys.forEach((uid) => {
      nextBucket[uid] = {
        userId: uid,
        buyerName: String(buyerName || '').trim().slice(0, 120),
        rating: safeRating,
        feedback: String(feedback || '').trim().slice(0, 1000),
        created_at: createdAt,
        updated_at: updatedAt,
      };
    });

    store[pid] = nextBucket;
    writeStore(store);
    return { summary: getLocalProductSummary(pid), entry: nextBucket[keys[0]] };
  },
};
