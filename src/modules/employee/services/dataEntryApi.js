/**
 * dataEntryApi.js — Data Entry employee service (backend-first)
 *
 * MIGRATION (Phase 3): All direct Supabase calls removed.
 * All operations route through /api/data-entry/* on the Express backend,
 * which enforces auth, role checks, and audit logging.
 */

import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeJson = async (res) => {
  try { return await res.json(); } catch { return {}; }
};

const de = (path) => apiUrl(`/api/data-entry${path}`);

// ─── API ──────────────────────────────────────────────────────────────────────

export const dataEntryApi = {

  // ── DASHBOARD ───────────────────────────────────────────────────────────────

  getDashboardStats: async (_userId) => {
    try {
      const res = await fetchWithCsrf(de('/dashboard/stats'));
      if (!res.ok) return { totalVendors: 0, totalProducts: 0, pendingKyc: 0, approvedKyc: 0 };
      const json = await res.json();
      return json?.stats || { totalVendors: 0, totalProducts: 0, pendingKyc: 0, approvedKyc: 0 };
    } catch {
      return { totalVendors: 0, totalProducts: 0, pendingKyc: 0, approvedKyc: 0 };
    }
  },

  getRecentActivities: async (_userId) => {
    try {
      const res = await fetchWithCsrf(de('/dashboard/recent-activities'));
      if (!res.ok) return [];
      const json = await res.json();
      return json?.activities || [];
    } catch { return []; }
  },

  getCategoryRequests: async (limit = 6) => {
    try {
      const res = await fetchWithCsrf(de(`/dashboard/category-requests?limit=${limit}`));
      if (!res.ok) return [];
      const json = await res.json();
      return json?.tickets || [];
    } catch { return []; }
  },

  // ── VENDORS ──────────────────────────────────────────────────────────────────

  /** List scoped vendors (created by / assigned to me) */
  getVendors: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.createdByMe) params.set('mine', 'true');
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const res = await fetchWithCsrf(de(`/vendors?${params}`));
    if (!res.ok) throw new Error('Failed to fetch vendors');
    const json = await res.json();
    return json?.vendors || [];
  },

  /** All vendors assigned to the logged-in employee */
  getAssignedVendors: async () => {
    const res = await fetchWithCsrf(de('/vendors?mine=true'));
    if (!res.ok) throw new Error('Failed to fetch assigned vendors');
    const json = await res.json();
    return json?.vendors || [];
  },

  /** All vendors with optional filtering */
  getAllVendors: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const res = await fetchWithCsrf(de(`/vendors?${params}`));
    if (!res.ok) throw new Error('Failed to fetch vendors');
    const json = await res.json();
    return json?.vendors || [];
  },

  getVendorById: async (vendorId) => {
    const res = await fetchWithCsrf(de(`/vendors/${vendorId}`));
    if (!res.ok) throw new Error('Failed to fetch vendor');
    const json = await res.json();
    return json?.vendor;
  },

  /** Generate a client-side vendor ID (mirrors server format, server will regenerate on create) */
  generateVendorId: () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const rand = (len, chars) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${rand(3, letters)}-VIN-${rand(4, digits)}-${rand(3, letters)}`;
  },

  createVendor: async (vendorData) => {
    const res = await fetchWithCsrf(de('/vendors'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vendorData),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create vendor');
    return json?.vendor;
  },

  // ── KYC DOCUMENTS ─────────────────────────────────────────────────────────

  getKycDocuments: async (vendorId) => {
    const res = await fetchWithCsrf(de(`/vendors/${vendorId}/documents`));
    if (!res.ok) throw new Error('Failed to fetch KYC documents');
    const json = await res.json();
    return json?.documents || [];
  },

  // Alias — some callers use uppercase variant
  getKYCDocuments: async (vendorId) => dataEntryApi.getKycDocuments(vendorId),

  approveVendorKyc: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/kyc/vendors/${vendorId}/approve`), { method: 'POST' });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'KYC approval failed');
    return json;
  },

  approveVendor: async (vendorId) => dataEntryApi.approveVendorKyc(vendorId),

  rejectVendorKyc: async (vendorId, remarks) => {
    const res = await fetchWithCsrf(apiUrl(`/api/kyc/vendors/${vendorId}/reject`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: remarks }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'KYC rejection failed');
    return json;
  },

  rejectVendor: async (vendorId, remarks) => dataEntryApi.rejectVendorKyc(vendorId, remarks),

  getVendorsGroupedByKycDocuments: async () => {
    const res = await fetchWithCsrf(de('/vendors/kyc-grouped'));
    if (!res.ok) throw new Error('Failed to fetch grouped KYC vendors');
    const json = await res.json();
    return {
      withDocuments: json?.withDocuments || [],
      withoutDocuments: json?.withoutDocuments || [],
    };
  },

  getVendorDocuments: async (vendorId) => dataEntryApi.getKycDocuments(vendorId),

  addVendorDocument: async (vendorId, documentType, documentUrl, originalName) => {
    const res = await fetchWithCsrf(de(`/vendors/${vendorId}/documents`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_type: documentType, document_url: documentUrl, original_name: originalName }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to add document');
    return json?.document;
  },

  // ── PRODUCTS ──────────────────────────────────────────────────────────────

  getVendorProducts: async (vendorId) => {
    const res = await fetchWithCsrf(de(`/vendors/${vendorId}/products`));
    if (!res.ok) throw new Error('Failed to fetch products');
    const json = await res.json();
    return json?.products || [];
  },

  getProduct: async (productId) => {
    const res = await fetchWithCsrf(de(`/products/${productId}`));
    if (!res.ok) throw new Error('Failed to fetch product');
    const json = await res.json();
    return json?.product;
  },

  getProductById: async (productId) => dataEntryApi.getProduct(productId),

  createProduct: async (productData) => {
    const res = await fetchWithCsrf(de('/products'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create product');
    return json?.product;
  },

  // Alias — some callers use addProduct
  addProduct: async (productData) => dataEntryApi.createProduct(productData),

  updateProduct: async (productId, updates) => {
    const res = await fetchWithCsrf(de(`/products/${productId}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to update product');
    return json?.product;
  },

  addProductImage: async (productId, imageUrl) => {
    const res = await fetchWithCsrf(de(`/products/${productId}/images`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to add image');
    return json?.image;
  },

  /** Upload product media — routes through existing employee upload endpoint */
  uploadProductMedia: async (file, type) => {
    if (!file) throw new Error('No file selected');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    const res = await fetchWithCsrf(apiUrl('/api/employee/product-media-upload'), {
      method: 'POST',
      body: JSON.stringify({ type, file_name: file.name || 'upload', content_type: file.type || '', data_url: dataUrl }),
    });
    const json = await safeJson(res);
    if (!res.ok || !json?.success) throw new Error(json?.error || `Upload failed (${res.status})`);
    const publicUrl = String(json?.publicUrl || '').trim();
    if (!publicUrl) throw new Error('Upload succeeded but URL was not returned');
    return publicUrl;
  },

  // ── CATEGORIES ────────────────────────────────────────────────────────────

  /** Full 3-level tree for dropdowns */
  getCategoriesTree: async () => {
    const res = await fetchWithCsrf(de('/categories/tree'));
    if (!res.ok) throw new Error('Failed to fetch category tree');
    const json = await res.json();
    return json?.tree || [];
  },

  getHeadCategories: async () => {
    const res = await fetchWithCsrf(de('/categories/head?withSubs=true'));
    if (!res.ok) throw new Error('Failed to fetch head categories');
    const json = await res.json();
    return json?.categories || [];
  },

  getAllHeadCategories: async () => {
    const res = await fetchWithCsrf(de('/categories/head'));
    if (!res.ok) throw new Error('Failed to fetch head categories');
    const json = await res.json();
    return json?.categories || [];
  },

  createHeadCategory: async (categoryData) => {
    const res = await fetchWithCsrf(de('/categories/head'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryData),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create category');
    return json?.category;
  },

  updateHeadCategory: async (id, updates) => {
    const res = await fetchWithCsrf(de(`/categories/head/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to update category');
    return json?.category;
  },

  deleteHeadCategory: async (id) => {
    const res = await fetchWithCsrf(de(`/categories/head/${id}`), { method: 'DELETE' });
    if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to delete category'); }
  },

  getSubCategories: async (headId) => {
    const res = await fetchWithCsrf(de(`/categories/sub?headId=${headId}`));
    if (!res.ok) throw new Error('Failed to fetch sub-categories');
    const json = await res.json();
    return json?.categories || [];
  },

  createSubCategory: async (categoryData) => {
    const res = await fetchWithCsrf(de('/categories/sub'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryData),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create sub-category');
    return json?.category;
  },

  updateSubCategory: async (id, updates) => {
    const res = await fetchWithCsrf(de(`/categories/sub/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to update sub-category');
    return json?.category;
  },

  deleteSubCategory: async (id) => {
    const res = await fetchWithCsrf(de(`/categories/sub/${id}`), { method: 'DELETE' });
    if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to delete sub-category'); }
  },

  getMicroCategories: async (subId) => {
    const res = await fetchWithCsrf(de(`/categories/micro?subId=${subId}`));
    if (!res.ok) throw new Error('Failed to fetch micro-categories');
    const json = await res.json();
    return json?.categories || [];
  },

  createMicroCategory: async (categoryData) => {
    const res = await fetchWithCsrf(de('/categories/micro'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryData),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create micro-category');
    return json?.category;
  },

  updateMicroCategory: async (id, updates) => {
    const res = await fetchWithCsrf(de(`/categories/micro/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to update micro-category');
    return json?.category;
  },

  deleteMicroCategory: async (id) => {
    const res = await fetchWithCsrf(de(`/categories/micro/${id}`), { method: 'DELETE' });
    if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to delete micro-category'); }
  },

  importCategoriesCSV: async (rows) => {
    const res = await fetchWithCsrf(de('/categories/import-csv'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'CSV import failed');
    return { success: json?.imported || 0, failed: json?.failed || 0, errors: json?.errors || [] };
  },

  // ── LOCATIONS ─────────────────────────────────────────────────────────────

  getStates: async () => {
    const res = await fetchWithCsrf(de('/locations/states'));
    if (!res.ok) throw new Error('Failed to fetch states');
    const json = await res.json();
    return json?.states || [];
  },

  getCitiesByState: async (stateId) => {
    const res = await fetchWithCsrf(de(`/locations/cities?stateId=${stateId}`));
    if (!res.ok) throw new Error('Failed to fetch cities');
    const json = await res.json();
    return json?.cities || [];
  },

  createState: async (name) => {
    const res = await fetchWithCsrf(de('/locations/states'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to create state'); }
  },

  updateState: async (id, name) => {
    const res = await fetchWithCsrf(de(`/locations/states/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to update state'); }
  },

  deleteState: async (id) => {
    const res = await fetchWithCsrf(de(`/locations/states/${id}`), { method: 'DELETE' });
    if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to delete state'); }
  },

  createCity: async (stateId, name) => {
    const res = await fetchWithCsrf(de('/locations/cities'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state_id: stateId, name }),
    });
    if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to create city'); }
  },

  updateCity: async (id, name) => {
    const res = await fetchWithCsrf(de(`/locations/cities/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to update city'); }
  },

  deleteCity: async (id) => {
    const res = await fetchWithCsrf(de(`/locations/cities/${id}`), { method: 'DELETE' });
    if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to delete city'); }
  },

  importLocationsCSV: async (rows) => {
    const res = await fetchWithCsrf(de('/locations/import-csv'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'CSV import failed');
    return { success: json?.imported || 0, failed: json?.failed || 0 };
  },

  // ── VENDOR SUB-TABLES ─────────────────────────────────────────────────────

  getVendorBankDetails: async (vendorId) => {
    const res = await fetchWithCsrf(de(`/vendors/${vendorId}/bank-details`));
    if (!res.ok) throw new Error('Failed to fetch bank details');
    const json = await res.json();
    return json?.bankDetails || [];
  },

  addBankAccount: async (vendorId, bankData) => {
    const res = await fetchWithCsrf(de(`/vendors/${vendorId}/bank-details`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bankData),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to add bank account');
    return json?.bankDetail;
  },

  getVendorContacts: async (vendorId) => {
    const res = await fetchWithCsrf(de(`/vendors/${vendorId}/contacts`));
    if (!res.ok) throw new Error('Failed to fetch contacts');
    const json = await res.json();
    return json?.contacts || [];
  },

  addContactPerson: async (vendorId, contactData) => {
    const res = await fetchWithCsrf(de(`/vendors/${vendorId}/contacts`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactData),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to add contact');
    return json?.contact;
  },

  getVendorSubscriptions: async (vendorId) => {
    const res = await fetchWithCsrf(de(`/vendors/${vendorId}/subscriptions`));
    if (!res.ok) throw new Error('Failed to fetch subscriptions');
    const json = await res.json();
    return json?.subscriptions || [];
  },

  getVendorPlans: async () => {
    const res = await fetchWithCsrf(de('/vendor-plans'));
    if (!res.ok) throw new Error('Failed to fetch vendor plans');
    const json = await res.json();
    return json?.plans || [];
  },

  // The following sub-table operations are lower risk (read via authenticated RLS)
  // but are included for completeness — migrate to dedicated routes if issues arise.

  getVendorPreferences: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorId}/preferences`));
    if (!res.ok) return null;
    const json = await res.json();
    return json?.preferences || null;
  },

  setVendorPreferences: async (vendorId, preferences) => {
    const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorId}/preferences`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to update preferences');
    return json?.preferences;
  },

  getVendorPayments: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorId}/payments`));
    if (!res.ok) return [];
    const json = await res.json();
    return json?.payments || [];
  },

  getVendorMessages: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorId}/messages`));
    if (!res.ok) return [];
    const json = await res.json();
    return json?.messages || [];
  },

  getVendorLeadQuota: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorId}/lead-quota`));
    if (!res.ok) return null;
    const json = await res.json();
    return json?.quota || null;
  },

  getAdditionalLeads: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorId}/additional-leads`));
    if (!res.ok) return [];
    const json = await res.json();
    return json?.leads || [];
  },

  getVendorServiceSubscriptions: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/vendors/${vendorId}/service-subscriptions`));
    if (!res.ok) return [];
    const json = await res.json();
    return json?.subscriptions || [];
  },

  createVendorOTP: async (vendorId, email) => {
    const res = await fetchWithCsrf(apiUrl('/api/otp/create-vendor'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id: vendorId, email }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create OTP');
    return json;
  },
};
