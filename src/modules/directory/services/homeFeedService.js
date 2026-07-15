import { apiUrl } from '@/lib/apiBase';

const EMPTY_FEED = {
  generatedAt: null,
  categories: [],
  products: [],
  vendors: [],
  stats: {},
};

export const getHomeFeed = async () => {
  const response = await fetch(apiUrl('/api/dir/home-feed'), {
    headers: { Accept: 'application/json' },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `Homepage data request failed (${response.status})`);
  }

  return {
    ...EMPTY_FEED,
    ...payload,
    categories: Array.isArray(payload?.categories) ? payload.categories : [],
    products: Array.isArray(payload?.products) ? payload.products : [],
    vendors: Array.isArray(payload?.vendors) ? payload.vendors : [],
    stats: payload?.stats && typeof payload.stats === 'object' ? payload.stats : {},
  };
};

