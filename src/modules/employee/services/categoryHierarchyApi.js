/**
 * categoryHierarchyApi.js — Category hierarchy service (backend-first)
 *
 * MIGRATION: All direct Supabase calls removed.
 * Routes through /api/data-entry/categories/* on the Express backend.
 */

import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

const safeJson = async (res) => { try { return await res.json(); } catch { return {}; } };

const cat = (path) => apiUrl(`/api/data-entry/categories${path}`);

export const categoryHierarchyApi = {

  // ── HEAD CATEGORIES ───────────────────────────────────────────────────────

  getHeadCategories: async () => {
    const res = await fetchWithCsrf(cat('/head?withSubs=true'));
    if (!res.ok) throw new Error('Failed to fetch head categories');
    const json = await res.json();
    return json?.categories || [];
  },

  createHeadCategory: async (payload) => {
    const res = await fetchWithCsrf(cat('/head'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create head category');
    return json?.category;
  },

  updateHeadCategory: async (id, payload) => {
    const res = await fetchWithCsrf(cat(`/head/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to update head category');
    return json?.category;
  },

  deleteHeadCategory: async (id) => {
    const res = await fetchWithCsrf(cat(`/head/${id}`), { method: 'DELETE' });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Cannot delete: check for sub-categories');
  },

  // ── SUB CATEGORIES ────────────────────────────────────────────────────────

  getSubCategories: async (headId) => {
    const res = await fetchWithCsrf(cat(`/sub?headId=${headId}`));
    if (!res.ok) throw new Error('Failed to fetch sub-categories');
    const json = await res.json();
    return json?.categories || [];
  },

  createSubCategory: async (payload) => {
    const res = await fetchWithCsrf(cat('/sub'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create sub-category');
    return json?.category;
  },

  updateSubCategory: async (id, payload) => {
    const res = await fetchWithCsrf(cat(`/sub/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to update sub-category');
    return json?.category;
  },

  deleteSubCategory: async (id) => {
    const res = await fetchWithCsrf(cat(`/sub/${id}`), { method: 'DELETE' });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Cannot delete: check for micro-categories');
  },

  // ── MICRO CATEGORIES ──────────────────────────────────────────────────────

  getMicroCategories: async (subId) => {
    const res = await fetchWithCsrf(cat(`/micro?subId=${subId}`));
    if (!res.ok) throw new Error('Failed to fetch micro-categories');
    const json = await res.json();
    return json?.categories || [];
  },

  createMicroCategory: async (payload) => {
    const res = await fetchWithCsrf(cat('/micro'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create micro-category');
    return json?.category;
  },

  updateMicroCategory: async (id, payload) => {
    const res = await fetchWithCsrf(cat(`/micro/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to update micro-category');
    return json?.category;
  },

  deleteMicroCategory: async (id) => {
    const res = await fetchWithCsrf(cat(`/micro/${id}`), { method: 'DELETE' });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to delete micro-category');
  },

  // ── META TAGS ─────────────────────────────────────────────────────────────
  // micro_category_meta is admin-only; route through admin endpoint

  getMicroCategoryMeta: async (microId) => {
    try {
      const res = await fetchWithCsrf(apiUrl(`/api/admin/categories/micro/${microId}/meta`));
      if (!res.ok) return [];
      const json = await res.json();
      return json?.meta || [];
    } catch { return []; }
  },

  createMicroCategoryMeta: async (payload) => {
    const res = await fetchWithCsrf(apiUrl('/api/admin/categories/micro/meta'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create meta');
    return json?.meta;
  },

  deleteMicroCategoryMeta: async (id) => {
    const res = await fetchWithCsrf(apiUrl(`/api/admin/categories/micro/meta/${id}`), { method: 'DELETE' });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to delete meta');
  },

  // ── IMPORT ────────────────────────────────────────────────────────────────

  importCategories: async (rows) => {
    const res = await fetchWithCsrf(cat('/import-csv'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'CSV import failed');
    return {
      success: json?.imported || 0,
      failed: json?.failed || 0,
      total: rows.length,
      errors: json?.errors || [],
    };
  },
};
