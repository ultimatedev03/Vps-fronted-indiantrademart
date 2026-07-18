import { apiUrl } from '@/lib/apiBase';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

async function request(path, options = {}) {
  const response = await fetchWithCsrf(apiUrl(path), {
    cache: 'no-store',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `Campaign request failed (${response.status})`);
  }
  return payload;
}

export const vendorCampaignApi = {
  active: () => request('/api/vendor-campaigns/active'),
  track: (campaignId, payload) =>
    request(`/api/vendor-campaigns/${campaignId}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
