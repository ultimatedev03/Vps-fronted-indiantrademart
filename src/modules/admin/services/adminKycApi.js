/**
 * adminKycApi.js — KYC management service (backend-first)
 *
 * MIGRATION NOTE (Phase 3): All KYC mutations now route through the
 * Express backend (/api/kyc/*) which enforces role guards, audit logging,
 * and sanitization. Direct Supabase writes are removed.
 */
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

export const adminKycApi = {
  /**
   * List vendors with KYC filtering, search, and pagination.
   * Maps to GET /api/admin/vendors
   */
  getAllVendors: async ({ status, search, page = 1, limit = 10 }) => {
    const params = new URLSearchParams({ page, limit });
    if (status && status !== 'all') params.set('kyc', status);
    if (search) params.set('search', search);

    const res = await fetchWithCsrf(apiUrl(`/api/admin/vendors?${params.toString()}`));
    if (!res.ok) throw new Error('Failed to fetch vendors for KYC');
    const json = await res.json();
    return {
      data: json?.vendors || [],
      count: json?.total ?? json?.count ?? 0,
    };
  },

  /**
   * Approve a vendor's KYC — routes through Express which handles
   * the DB update, badge assignment, and notification dispatch.
   */
  approveVendor: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/kyc/vendors/${vendorId}/approve`), {
      method: 'POST',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error || json?.message || 'KYC approval failed');
    }
    return true;
  },

  /**
   * Reject a vendor's KYC with a reason — routes through Express.
   */
  rejectVendor: async (vendorId, remarks) => {
    const res = await fetchWithCsrf(apiUrl(`/api/kyc/vendors/${vendorId}/reject`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: remarks }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error || json?.message || 'KYC rejection failed');
    }
    return true;
  },

  /**
   * Get reviewer remarks for a vendor's KYC.
   * Maps to GET /api/kyc/vendors/:vendorId/remarks
   */
  getVendorRemarks: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/kyc/vendors/${vendorId}/remarks`));
    if (!res.ok) {
      console.warn('[adminKycApi.getVendorRemarks] Failed:', res.status);
      return [];
    }
    const json = await res.json();
    return json?.remarks || [];
  },
};
