import { superAdminFetch } from '@/lib/superAdminApiClient';

async function readJson(res) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  throw new Error(`Superadmin API returned non-JSON (${res.status}): ${text.slice(0, 160)}`);
}

async function request(path, options) {
  const res = await superAdminFetch(path, options);
  const data = await readJson(res);
  if (!data?.success) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const superAdminServerApi = {
  auth: {
    login: (email, password, options = {}) =>
      request('/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          ...(options?.captcha_token ? { captcha_token: options.captcha_token } : {}),
          ...(options?.captcha_action ? { captcha_action: options.captcha_action } : {}),
        }),
      }),
    me: () => request('/me'),
    changePassword: (current_password, new_password) =>
      request('/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password, new_password }),
      }),
  },

  employees: {
    list: () => request('/employees'),
    create: (payload) =>
      request('/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    delete: (employeeId) =>
      request(`/employees/${employeeId}`, {
        method: 'DELETE',
      }),
    resetPassword: (employeeId, password) =>
      request(`/employees/${employeeId}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password }),
      }),
  },

  states: {
    list: () => request('/states'),
  },

  vendors: {
    list: (params = {}) => {
      const normalized = typeof params === 'number' ? { limit: params } : (params || {});
      const qs = new URLSearchParams();
      qs.set('limit', String(normalized.limit ?? 500));
      if (normalized.offset !== undefined && normalized.offset !== null) {
        qs.set('offset', String(normalized.offset));
      }
      return request(`/vendors?${qs.toString()}`);
    },
    delete: (vendorId) =>
      request(`/vendors/${vendorId}`, {
        method: 'DELETE',
      }),
  },

  plans: {
    list: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v) !== '') qs.set(k, v);
      });
      const query = qs.toString();
      return request(`/plans${query ? `?${query}` : ''}`);
    },
    create: (payload) =>
      request('/plans', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (planId, payload) =>
      request(`/plans/${planId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (planId) =>
      request(`/plans/${planId}`, {
        method: 'DELETE',
      }),
  },

  finance: {
    summary: () => request('/finance/summary'),
    payments: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v) !== '') qs.set(k, v);
      });
      const query = qs.toString();
      return request(`/finance/payments${query ? `?${query}` : ''}`);
    },
  },

  system: {
    getConfig: () => request('/system-config'),
    updateConfig: (payload) =>
      request('/system-config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
  },

  pages: {
    list: () => request('/page-status'),
    create: (payload) =>
      request('/page-status', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (pageId, payload) =>
      request(`/page-status/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (pageId) =>
      request(`/page-status/${pageId}`, {
        method: 'DELETE',
      }),
  },

  audit: {
    list: (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v) !== '') qs.set(k, v);
      });
      const query = qs.toString();
      return request(`/audit-logs${query ? `?${query}` : ''}`);
    },
  },

  monitoring: {
    overview: () => request('/monitoring/overview'),
    adminActivity: (days = 7) => request(`/monitoring/admin-activity?days=${encodeURIComponent(days)}`),
    revenueByState: () => request('/monitoring/revenue-by-state'),
    updateStatesScope: (employeeId, state_scope_ids) =>
      request(`/employees/${employeeId}/states-scope`, {
        method: 'PUT',
        body: JSON.stringify({ state_scope_ids }),
      }),
  },

  // GOD MODE only — manage SUPERADMIN accounts
  godmode: {
    listSuperadmins: () => request('/godmode/superadmins'),
    createSuperadmin: (payload) =>
      request('/godmode/superadmins', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    toggleActive: (id) =>
      request(`/godmode/superadmins/${id}/toggle-active`, { method: 'PUT' }),
    deleteSuperadmin: (id) =>
      request(`/godmode/superadmins/${id}`, { method: 'DELETE' }),
    resetPassword: (id, password) =>
      request(`/godmode/superadmins/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password }),
      }),
  },
};
