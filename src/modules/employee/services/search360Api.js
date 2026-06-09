import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

const readJson = async (res) => {
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `Search 360 request failed (${res.status})`);
  }
  return data;
};

export const search360Api = {
  search: async ({ query = '', limit = 25, offset = 0, stateId = '' } = {}) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (stateId) params.set('stateId', stateId);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const res = await fetchWithCsrf(apiUrl(`/api/employee/search360/vendors?${params.toString()}`));
    return readJson(res);
  },

  escalate: async (payload) => {
    const res = await fetchWithCsrf(apiUrl('/api/employee/search360/escalations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return readJson(res);
  },

  updateCaseStatus: async (caseId, payload) => {
    const res = await fetchWithCsrf(apiUrl(`/api/employee/search360/cases/${caseId}/status`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return readJson(res);
  },
};

export default search360Api;
