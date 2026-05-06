import { apiUrl } from '@/lib/apiBase';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

const parseJson = async (res) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

const unwrap = async (res, fallbackMessage) => {
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || fallbackMessage);
  }
  return data;
};

const isMissingSalesNoteSchemaError = (message = '') => {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('sales_note') && (normalized.includes('schema cache') || normalized.includes('column'));
};

const patchLead = async (leadId, updates = {}) => {
  const res = await fetchWithCsrf(apiUrl(`/api/employee/sales/leads/${leadId}`), {
    method: 'PATCH',
    body: JSON.stringify(updates || {}),
  });
  return unwrap(res, 'Failed to update lead');
};

export const salesApi = {
  getStats: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/sales/stats'));
    const data = await unwrap(res, 'Failed to load sales stats');
    return data?.stats || null;
  },

  getAllLeads: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/sales/leads'));
    const data = await unwrap(res, 'Failed to load leads');
    return data?.leads || [];
  },

  updateLeadStatus: async (id, status) => {
    const leadId = String(id || '').trim();
    const nextStatus = String(status || '').trim().toUpperCase();
    if (!leadId || !nextStatus) {
      throw new Error('leadId and status are required');
    }

    const res = await fetchWithCsrf(apiUrl(`/api/employee/sales/leads/${leadId}/status`), {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await unwrap(res, 'Failed to update lead status');
    return data?.lead || null;
  },

  updateLead: async (id, updates = {}) => {
    const leadId = String(id || '').trim();
    if (!leadId) {
      throw new Error('leadId is required');
    }

    try {
      const data = await patchLead(leadId, updates);
      return data?.lead || null;
    } catch (error) {
      if (!Object.prototype.hasOwnProperty.call(updates || {}, 'sales_note') || !isMissingSalesNoteSchemaError(error?.message)) {
        throw error;
      }

      const retryPayload = { ...(updates || {}) };
      delete retryPayload.sales_note;

      const data = await patchLead(leadId, retryPayload);
      return data?.lead || null;
    }
  },

  getPricingRules: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/sales/pricing-rules'));
    const data = await unwrap(res, 'Failed to load pricing rules');
    return data?.rules || [];
  },

  createPricingRule: async (payload = {}) => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/sales/pricing-rules'), {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
    const data = await unwrap(res, 'Failed to create pricing rule');
    return data?.rule || null;
  },

  getManagerPricingApprovals: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/manager/pricing-approvals'));
    const data = await unwrap(res, 'Failed to load pricing approvals');
    return data?.rules || [];
  },

  decidePricingRule: async (ruleId, decision, remarks = '') => {
    const normalizedRuleId = String(ruleId || '').trim();
    if (!normalizedRuleId) {
      throw new Error('ruleId is required');
    }

    const res = await fetchWithCsrf(apiUrl(`/api/employee/manager/pricing-approvals/${normalizedRuleId}/decision`), {
      method: 'POST',
      body: JSON.stringify({
        decision,
        remarks,
      }),
    });
    const data = await unwrap(res, 'Failed to update pricing rule approval');
    return data?.rule || null;
  },

  // ── Vendor search (for subscription request form) ─────────────────────────

  searchVendors: async (q = '') => {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await fetchWithCsrf(apiUrl(`/api/employee/sales/vendors${query}`));
    const data = await unwrap(res, 'Failed to search vendors');
    return data?.vendors || [];
  },

  // ── Subscription Extension Requests ──────────────────────────────────────

  createExtensionRequest: async (payload = {}) => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/subscription-requests'), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await unwrap(res, 'Failed to create extension request');
    return data?.request || null;
  },

  getMyExtensionRequests: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/subscription-requests'));
    const data = await unwrap(res, 'Failed to load extension requests');
    return data?.requests || [];
  },

  getManagerExtensionRequests: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/subscription-requests/manager'));
    const data = await unwrap(res, 'Failed to load manager extension requests');
    return data?.requests || [];
  },

  forwardToVp: async (id, manager_note = '') => {
    const res = await fetchWithCsrf(apiUrl(`/api/employee/subscription-requests/${id}/manager-forward`), {
      method: 'POST',
      body: JSON.stringify({ manager_note }),
    });
    const data = await unwrap(res, 'Failed to forward request to VP');
    return data?.request || null;
  },

  getVpExtensionRequests: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/subscription-requests/vp'));
    const data = await unwrap(res, 'Failed to load VP extension requests');
    return data?.requests || [];
  },

  forwardToAdmin: async (id, vp_note = '') => {
    const res = await fetchWithCsrf(apiUrl(`/api/employee/subscription-requests/${id}/vp-forward`), {
      method: 'POST',
      body: JSON.stringify({ vp_note }),
    });
    const data = await unwrap(res, 'Failed to forward request to Admin');
    return data?.request || null;
  },
};
