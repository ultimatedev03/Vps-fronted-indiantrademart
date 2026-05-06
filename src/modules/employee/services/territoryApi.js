import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

const isLocalHost = () => {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
};

const getTerritoryBase = () => {
  const override = import.meta.env.VITE_TERRITORY_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return isLocalHost() ? '/api/territory' : '/.netlify/functions/territory';
};

const safeJson = async (res) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

const unwrap = async (res, fallback) => {
  const data = await safeJson(res);
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || data?.message || fallback);
  }
  return data;
};

const withQuery = (path, query = {}) => {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  return params.toString() ? `${path}?${params.toString()}` : path;
};

export const territoryApi = {
  getDivisions: async (query = {}) => {
    const base = getTerritoryBase();
    const res = await fetchWithCsrf(withQuery(`${base}/divisions`, query));
    const data = await unwrap(res, 'Failed to fetch divisions');
    return data?.divisions || [];
  },

  getEmployees: async (role = '') => {
    const base = getTerritoryBase();
    const res = await fetchWithCsrf(withQuery(`${base}/employees`, { role }));
    const data = await unwrap(res, 'Failed to fetch employees');
    return data?.employees || [];
  },

  getVpManagerAllocations: async (query = {}) => {
    const base = getTerritoryBase();
    const res = await fetchWithCsrf(withQuery(`${base}/allocations/vp-manager`, query));
    const data = await unwrap(res, 'Failed to fetch VP allocations');
    return data?.allocations || [];
  },

  saveVpManagerAllocations: async (payload = {}) => {
    const base = getTerritoryBase();
    const res = await fetchWithCsrf(`${base}/allocations/vp-manager`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await unwrap(res, 'Failed to save VP allocations');
    return data?.summary || null;
  },

  getManagerSalesAllocations: async (query = {}) => {
    const base = getTerritoryBase();
    const res = await fetchWithCsrf(withQuery(`${base}/allocations/manager-sales`, query));
    const data = await unwrap(res, 'Failed to fetch manager allocations');
    return data?.allocations || [];
  },

  saveManagerSalesAllocations: async (payload = {}) => {
    const base = getTerritoryBase();
    const res = await fetchWithCsrf(`${base}/allocations/manager-sales`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await unwrap(res, 'Failed to save manager allocations');
    return data?.summary || null;
  },

  getSalesVendors: async (query = {}) => {
    const base = getTerritoryBase();
    const res = await fetchWithCsrf(withQuery(`${base}/sales/vendors`, query));
    const data = await unwrap(res, 'Failed to fetch sales vendors');
    return {
      vendors: data?.vendors || [],
      meta: data?.meta || {},
    };
  },

  createEngagement: async (payload = {}) => {
    const base = getTerritoryBase();
    const res = await fetchWithCsrf(`${base}/sales/engagements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await unwrap(res, 'Failed to save engagement');
    return data?.engagement || null;
  },

  getEngagements: async (query = {}) => {
    const base = getTerritoryBase();
    const res = await fetchWithCsrf(withQuery(`${base}/sales/engagements`, query));
    const data = await unwrap(res, 'Failed to fetch engagements');
    return data?.engagements || [];
  },
};

