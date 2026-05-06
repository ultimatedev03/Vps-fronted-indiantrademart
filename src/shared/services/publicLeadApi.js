import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

const stripUndefined = (payload = {}) =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const sortKeys = (payload = {}) =>
  Object.keys(payload)
    .sort()
    .reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});

const buildMinimalLeadPayload = (payload = {}) =>
  stripUndefined({
    title: payload.title || payload.product_name || payload.category || 'New enquiry',
    product_name: payload.product_name || payload.title || payload.category || 'General enquiry',
    category: payload.category || 'General',
    quantity: payload.quantity || null,
    budget: payload.budget ?? 0,
    location: payload.location || 'India',
    buyer_name: payload.buyer_name || 'Buyer',
    buyer_email: payload.buyer_email || '',
    buyer_phone: payload.buyer_phone || '',
    company_name: payload.company_name || null,
    product_interest: payload.product_interest || payload.product_name || payload.title || 'General',
    message: payload.message || payload.description || payload.title || 'New enquiry',
    status: payload.status || 'AVAILABLE',
    created_at: payload.created_at || new Date().toISOString(),
  });

export const normalizeIndianPhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
};

export const isValidIndianPhone = (value) => /^[6-9]\d{9}$/.test(normalizeIndianPhone(value));

const postLeadPayload = async (payload = {}) => {
  const vendorId = String(payload.vendor_id || '').trim();
  const endpoint = vendorId
    ? apiUrl(`/api/vendors/${encodeURIComponent(vendorId)}/leads`)
    : apiUrl('/api/vendors/marketplace/leads');

  const response = await fetchWithCsrf(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || 'Failed to submit requirement');
  }

  return json?.lead || json?.proposal || json || null;
};

export const submitPublicLead = async (leadPayload = {}) => {
  const attempts = [stripUndefined({ ...leadPayload })];
  const minimalPayload = buildMinimalLeadPayload(leadPayload);
  attempts.push(minimalPayload);
  attempts.push(
    stripUndefined({
      ...minimalPayload,
      category: undefined,
      location: undefined,
      company_name: undefined,
    })
  );

  const seen = new Set();
  let lastError = null;

  while (attempts.length) {
    const payload = attempts.shift();
    const signature = JSON.stringify(sortKeys(payload));
    if (seen.has(signature)) continue;
    seen.add(signature);

    try {
      return await postLeadPayload(payload);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to submit lead');
};
