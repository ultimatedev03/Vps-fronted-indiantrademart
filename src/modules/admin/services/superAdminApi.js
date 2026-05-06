/**
 * superAdminApi.js — Super Admin service (backend-first)
 *
 * MIGRATION: All direct Supabase calls removed.
 * Routes through /api/superadmin/* on the Express backend, which enforces
 * superadmin-level auth, audit logging, and role checks.
 */

import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

const safeJson = async (res) => { try { return await res.json(); } catch { return {}; } };

const sa = (path) => apiUrl(`/api/superadmin${path}`);

export const superAdminApi = {

  // ── SYSTEM CONFIGURATION ──────────────────────────────────────────────────

  system: {
    getMaintenanceStatus: async () => {
      const res = await fetchWithCsrf(sa('/system-config'));
      if (!res.ok) throw new Error('Failed to fetch system config');
      const json = await res.json();
      return json?.config || json?.data || json;
    },

    updateMaintenanceStatus: async (maintenanceMode, maintenanceMessage, _userId) => {
      const res = await fetchWithCsrf(sa('/system-config'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenance_mode: maintenanceMode, maintenance_message: maintenanceMessage }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to update maintenance status');
      return json?.config || json?.data;
    },

    getSystemLogs: async () => {
      const res = await fetchWithCsrf(sa('/audit-logs?limit=50'));
      if (!res.ok) return [];
      const json = await res.json();
      return json?.logs || json?.data || [];
    },
  },

  // ── PAGE CONTROL ──────────────────────────────────────────────────────────

  pages: {
    getAll: async () => {
      const res = await fetchWithCsrf(sa('/page-status'));
      if (!res.ok) throw new Error('Failed to fetch page status');
      const json = await res.json();
      return json?.pages || json?.data || [];
    },

    updateStatus: async (pageId, isBlanked, errorMessage) => {
      const res = await fetchWithCsrf(sa(`/page-status/${pageId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_blanked: isBlanked, error_message: errorMessage }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to update page status');
      return json?.page || json?.data;
    },

    create: async (pageName, pageRoute, errorMessage) => {
      const res = await fetchWithCsrf(sa('/page-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_name: pageName, page_route: pageRoute, error_message: errorMessage }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to create page status');
      return json?.page || json?.data;
    },

    delete: async (pageId) => {
      const res = await fetchWithCsrf(sa(`/page-status/${pageId}`), { method: 'DELETE' });
      if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to delete page status'); }
      return true;
    },
  },

  // ── USER MANAGEMENT ───────────────────────────────────────────────────────

  users: {
    getAll: async (page = 1, limit = 10, search = '', roleFilter = 'ALL', statusFilter = 'ALL') => {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await fetchWithCsrf(apiUrl(`/api/admin/users?${params}`));
      if (!res.ok) throw new Error('Failed to fetch users');
      const json = await res.json();
      return { data: json?.users || [], count: json?.total || 0 };
    },

    create: async (userData) => {
      const res = await fetchWithCsrf(sa('/employees'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to create user');
      return json?.employee || json?.data;
    },

    update: async (userId, userData) => {
      const res = await fetchWithCsrf(apiUrl(`/api/employee/staff/${userId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to update user');
      return json?.employee || json?.data;
    },

    delete: async (userId) => {
      const res = await fetchWithCsrf(sa(`/employees/${userId}`), { method: 'DELETE' });
      if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to delete user'); }
      return true;
    },

    resetPassword: async (userId, newPassword) => {
      const res = await fetchWithCsrf(sa(`/employees/${userId}/password`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to reset password');
      return true;
    },

    toggleStatus: async (userId, currentStatus) => {
      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await fetchWithCsrf(apiUrl(`/api/employee/staff/${userId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to toggle status');
      return newStatus;
    },
  },

  // ── DASHBOARD STATS ───────────────────────────────────────────────────────

  getDashboardStats: async () => {
    try {
      const res = await fetchWithCsrf(sa('/monitoring/overview'));
      if (!res.ok) return { totalUsers: 0, totalVendors: 0, totalProducts: 0 };
      const json = await res.json();
      const data = json?.overview || json?.data || json || {};
      return {
        totalUsers: Number(data.totalUsers ?? data.total_users ?? 0) || 0,
        totalVendors: Number(data.totalVendors ?? data.total_vendors ?? 0) || 0,
        totalProducts: Number(data.totalProducts ?? data.total_products ?? 0) || 0,
      };
    } catch {
      return { totalUsers: 0, totalVendors: 0, totalProducts: 0 };
    }
  },
};
