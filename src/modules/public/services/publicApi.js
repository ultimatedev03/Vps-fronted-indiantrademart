import { apiUrl } from '@/lib/apiBase';

export const publicApi = {
  getStates: async () => {
    const res = await fetch(apiUrl('/api/dir/states'));
    const json = await res.json();
    return json?.states || [];
  },
  getCities: async (stateId) => {
    if (!stateId) return [];
    const res = await fetch(apiUrl('/api/dir/cities') + '?stateId=' + stateId);
    const json = await res.json();
    return json?.cities || [];
  },
  getHeadCategories: async () => {
    const res = await fetch(apiUrl('/api/dir/head-categories'));
    const json = await res.json();
    return json?.categories || [];
  },
  getSubCategories: async (headCategoryId) => {
    if (!headCategoryId) return [];
    const res = await fetch(apiUrl('/api/dir/sub-categories') + '?headId=' + headCategoryId);
    const json = await res.json();
    return json?.categories || [];
  },
  getMicroCategories: async (subCategoryId) => {
    if (!subCategoryId) return [];
    const res = await fetch(apiUrl('/api/dir/micro-categories') + '?subId=' + subCategoryId);
    const json = await res.json();
    return json?.categories || [];
  },
  getCategoryHierarchy: async () => {
    const res = await fetch(apiUrl('/api/dir/hierarchy'));
    const json = await res.json();
    return json?.hierarchy || [];
  },
  getBrands: async () => {
    return [];
  },
  getProducts: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await fetch(apiUrl('/api/dir/products/list') + '?' + params.toString());
    const json = await res.json();
    return json?.products || [];
  },
  getProductDetail: async (productId) => {
    const res = await fetch(apiUrl('/api/dir/product/id/' + productId));
    const json = await res.json();
    return json?.product || {};
  },
  searchVendors: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await fetch(apiUrl('/api/dir/vendors/search') + '?' + params.toString());
    const json = await res.json();
    return json?.vendors || [];
  },
  getVendorDetail: async (vendorId) => {
    const res = await fetch(apiUrl('/api/dir/vendors/detail/' + vendorId));
    const json = await res.json();
    return json?.vendor || {};
  },
  getVendorRatings: async (vendorId) => {
    const res = await fetch(apiUrl('/api/dir/vendors/' + vendorId + '/ratings'));
    const json = await res.json();
    return json?.ratings || {};
  },
  getPublicLeads: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await fetch(apiUrl('/api/dir/leads/public') + '?' + params.toString());
    const json = await res.json();
    return json?.leads || [];
  },
  submitContact: async (contactData) => {
    const res = await fetch(apiUrl('/api/dir/contact'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactData)
    });
    const json = await res.json();
    return json?.submission || {};
  }
};
