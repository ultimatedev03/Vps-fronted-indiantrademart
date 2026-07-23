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

async function publicRequest(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(apiUrl(path), {
    cache: 'no-store',
    credentials: 'omit',
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `Campaign request failed (${response.status})`);
  }
  return payload;
}

export const vendorCampaignApi = {
  active: ({ preview = false } = {}) =>
    request(`/api/vendor-campaigns/active${preview ? '?preview=1' : ''}`),
  track: (campaignId, payload) =>
    request(`/api/vendor-campaigns/${campaignId}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  homepageActive: ({ visitorId }) =>
    publicRequest(`/api/vendor-campaigns/homepage/active?visitor_id=${encodeURIComponent(visitorId)}`),
  homepageTrack: (campaignId, payload) =>
    publicRequest(`/api/vendor-campaigns/homepage/${encodeURIComponent(campaignId)}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
