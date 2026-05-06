/**
 * usersApi.js — Admin users service (backend-first)
 *
 * MIGRATION: All direct Supabase calls removed.
 * User creation now goes through /api/employee/staff (server-side invite flow)
 * which uses the Supabase admin client to avoid the "current session clobbered"
 * problem of client-side signUp.
 */

import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

const safeJson = async (res) => { try { return await res.json(); } catch { return {}; } };

export const usersApi = {

  // ── USERS CRUD ────────────────────────────────────────────────────────────

  /**
   * Create a user via the server-side staff invite endpoint.
   * This avoids the client-side supabase.auth.signUp() which would
   * clobber the current admin session by immediately logging in as the new user.
   */
  createUser: async (userData) => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/staff'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: userData.full_name,
        email: userData.email,
        phone: userData.phone,
        role: userData.role || 'USER',
        department: userData.department || 'General',
        password: userData.password,
        status: 'ACTIVE',
      }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to create user');
    return json?.employee || json?.data;
  },

  getUser: async (id) => {
    const res = await fetchWithCsrf(apiUrl(`/api/admin/users/${id}`));
    if (!res.ok) throw new Error('Failed to fetch user');
    const json = await res.json();
    return json?.user || json?.data;
  },

  listUsers: async (roleFilter = null) => {
    const params = new URLSearchParams();
    if (roleFilter) params.set('role', roleFilter);
    const res = await fetchWithCsrf(apiUrl(`/api/admin/users?${params}`));
    if (!res.ok) throw new Error('Failed to fetch users');
    const json = await res.json();
    return json?.users || [];
  },

  updateUser: async (id, updates) => {
    const payload = {};
    if (updates.full_name !== undefined) payload.full_name = updates.full_name;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.role !== undefined) payload.role = updates.role;

    const res = await fetchWithCsrf(apiUrl(`/api/employee/staff/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error || 'Failed to update user');
    return json?.employee || json?.data;
  },

  deleteUser: async (id) => {
    const res = await fetchWithCsrf(apiUrl(`/api/superadmin/employees/${id}`), { method: 'DELETE' });
    if (!res.ok) { const j = await safeJson(res); throw new Error(j?.error || 'Failed to delete user'); }
  },

  // ── ADMIN MANAGEMENT ──────────────────────────────────────────────────────

  admins: {
    list: async () => {
      const res = await fetchWithCsrf(apiUrl('/api/admin/users?role=ADMIN'));
      if (!res.ok) throw new Error('Failed to fetch admins');
      const json = await res.json();
      return json?.users || [];
    },
  },

  // ── EMPLOYEE MANAGEMENT ───────────────────────────────────────────────────

  employees: {
    create: async (employeeData) => {
      const res = await fetchWithCsrf(apiUrl('/api/employee/staff'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to create employee');
      return json?.employee || json?.data;
    },

    list: async () => {
      const res = await fetchWithCsrf(apiUrl('/api/employee/staff'));
      if (!res.ok) throw new Error('Failed to fetch employees');
      const json = await res.json();
      return json?.employees || [];
    },

    update: async (id, updates) => {
      const res = await fetchWithCsrf(apiUrl(`/api/employee/staff/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to update employee');
      return json?.employee || json?.data;
    },

    assignToVendor: async (employeeId, vendorId) => {
      const res = await fetchWithCsrf(apiUrl(`/api/admin/vendors/${vendorId}/assign`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || 'Failed to assign employee to vendor');
    },
  },
};
