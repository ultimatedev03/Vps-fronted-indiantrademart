import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

const fetchReferralJson = async (path, options = {}) => {
  const res = await fetchWithCsrf(apiUrl(path), options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    const message = json?.error || json?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json;
};

export const referralApi = {
  getOverview: async () => {
    const json = await fetchReferralJson('/api/referrals/me');
    return json?.data || {};
  },

  linkCode: async (referralCode) => {
    const json = await fetchReferralJson('/api/referrals/link', {
      method: 'POST',
      body: JSON.stringify({
        referral_code: String(referralCode || '').trim().toUpperCase(),
      }),
    });
    return json?.data || null;
  },

  getCashouts: async () => {
    const json = await fetchReferralJson('/api/referrals/cashouts');
    return json?.data || [];
  },

  requestCashout: async ({ amount, note = '', bankDetailId = null }) => {
    const json = await fetchReferralJson('/api/referrals/cashout', {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(amount || 0),
        note: String(note || '').trim() || null,
        bank_detail_id: bankDetailId || null,
      }),
    });
    return json?.data || null;
  },
};

