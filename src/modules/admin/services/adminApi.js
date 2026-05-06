import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

export const adminApi = {
  getDashboardOverview: async () => {
    try {
      const res = await fetchWithCsrf(apiUrl('/api/admin/dashboard/overview'));
      if (res.ok) {
        const data = await res.json();
        const raw = data?.overview ?? data?.data ?? data ?? {};

        return {
          totalUsers: Number(raw?.totalUsers ?? raw?.users ?? 0) || 0,
          activeVendors: Number(raw?.activeVendors ?? raw?.vendors ?? 0) || 0,
          totalOrders: Number(raw?.totalOrders ?? raw?.orders ?? 0) || 0,
          totalRevenue: Number(raw?.totalRevenue ?? raw?.revenue ?? 0) || 0,
          totalBuyers: Number(raw?.totalBuyers ?? raw?.buyers ?? 0) || 0,
          totalProducts: Number(raw?.totalProducts ?? raw?.products ?? 0) || 0,
          pendingKyc: Number(raw?.pendingKyc ?? raw?.pending_kyc ?? 0) || 0,
          openTickets: Number(raw?.openTickets ?? raw?.tickets ?? 0) || 0,
        };
      }
    } catch (e) {
      console.warn('[adminApi.getDashboardOverview] server error:', e);
    }

    // Fallback: compose from individual endpoints (no recursive calls to getStats)
    const counts = await adminApi.getDashboardCounts().catch(() => ({}));

    let openTickets = 0;
    try {
      const res = await fetchWithCsrf(apiUrl('/api/support/stats'));
      if (res.ok) {
        const data = await res.json();
        const supportStats = data?.stats || {};
        openTickets = Number(supportStats.openTickets || 0) + Number(supportStats.inProgressTickets || 0);
      }
    } catch {
      openTickets = 0;
    }

    return {
      totalUsers: 0,
      activeVendors: 0,
      totalOrders: 0,
      totalRevenue: 0,
      ...counts,
      openTickets,
    };
  },


  getStats: async () => {
    // Directly hits the dashboard endpoint — does NOT call getDashboardOverview to avoid circular calls
    const res = await fetchWithCsrf(apiUrl('/api/admin/dashboard/overview'));
    if (!res.ok) return { totalUsers: 0, activeVendors: 0, totalOrders: 0, totalRevenue: 0 };
    const data = await res.json();
    const raw = data?.overview ?? data?.data ?? data ?? {};
    return {
      totalUsers: Number(raw?.totalUsers ?? raw?.users ?? 0) || 0,
      activeVendors: Number(raw?.activeVendors ?? raw?.vendors ?? 0) || 0,
      totalOrders: Number(raw?.totalOrders ?? raw?.orders ?? 0) || 0,
      totalRevenue: Number(raw?.totalRevenue ?? raw?.revenue ?? 0) || 0,
    };
  },

  // ✅ NEW: Server-first dashboard counts (prevents buyers/products showing 0 due to RLS)
  getDashboardCounts: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/admin/dashboard/counts'));
    if (!res.ok) return { totalBuyers: 0, totalProducts: 0, pendingKyc: 0 };
    
    const data = await res.json();
    const raw = data?.counts ?? data?.data?.counts ?? data?.data ?? data ?? {};

    return {
      totalBuyers: Number(raw?.totalBuyers ?? raw?.buyers ?? raw?.buyersCount ?? 0) || 0,
      totalProducts: Number(raw?.totalProducts ?? raw?.products ?? raw?.productsCount ?? 0) || 0,
      pendingKyc: Number(raw?.pendingKyc ?? raw?.pending_kyc ?? raw?.pendingKycCount ?? 0) || 0,
    };
  },

  getRecentLeadPurchases: async (limit = 10) => {
    const res = await fetchWithCsrf(apiUrl(`/api/admin/dashboard/recent-lead-purchases?limit=${limit}`));
    if (res.ok) {
      const data = await res.json();
      // Handle both 'orders' and 'purchases' key variants from backend
      return data?.orders || data?.purchases || [];
    }
    console.warn('[adminApi.getRecentLeadPurchases] Failed:', res.status);
    return [];
  },

  getDataEntryPerformance: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/admin/dashboard/data-entry-performance'));
    if (res.ok) {
      const data = await res.json();
      return data?.performance || [];
    }
    return [];
  },

  getRecentTickets: async (limit = 5) => {
    const res = await fetchWithCsrf(apiUrl(`/api/admin/dashboard/recent-support-tickets?limit=${Math.min(Number(limit || 5), 50)}`));
    if (res.ok) {
      const data = await res.json();
      return data?.tickets || [];
    }
    console.warn('[adminApi.getRecentTickets] Failed:', res.status);
    return [];
  },

  getRecentVendors: async (limit = 5) => {
    const res = await fetchWithCsrf(apiUrl(`/api/admin/dashboard/recent-vendors?limit=${Math.min(Number(limit || 5), 50)}`));
    if (res.ok) {
      const data = await res.json();
      return data?.vendors || [];
    }
    console.warn('[adminApi.getRecentVendors] Failed:', res.status);
    return [];
  },

  getVendorsByCreator: async (creatorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/admin/vendors?creatorId=${creatorId}`));
    if (!res.ok) throw new Error('Failed to fetch vendors by creator');
    const json = await res.json();
    return json?.vendors || [];
  },

  // ✅ Buyers API (NEW)
  buyers: {
    list: async () => {
      const res = await fetchWithCsrf(apiUrl('/api/admin/buyers'));
      if (!res.ok) throw new Error('Failed to fetch buyers');
      const json = await res.json();
      return json?.buyers || [];
    },

    setActive: async (buyerId, isActive, reason = '') => {
      const endpoint = isActive ? `/api/admin/buyers/${buyerId}/activate` : `/api/admin/buyers/${buyerId}/terminate`;
      const res = await fetchWithCsrf(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Failed to update buyer status');
    }
  },

  // Data Entry API - Products
  products: {
    list: async (vendorId = null) => {
      const url = vendorId ? `/api/admin/vendors/${vendorId}/products` : `/api/admin/products?limit=100`;
      const res = await fetchWithCsrf(apiUrl(url));
      if (!res.ok) throw new Error('Failed to fetch products');
      const json = await res.json();
      return json?.products || [];
    }
  },

  // Data Entry API - States
  states: {
    list: async () => {
      const res = await fetchWithCsrf(apiUrl('/api/admin/states'));
      if (!res.ok) throw new Error('Failed to fetch states');
      const json = await res.json();
      return json?.data || [];
    },
    create: async (name) => {
      const res = await fetchWithCsrf(apiUrl('/api/admin/states'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to create state');
      const json = await res.json();
      return json?.data;
    },
    update: async (id, name, isActive) => {
      const res = await fetchWithCsrf(apiUrl(`/api/admin/states/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, is_active: isActive })
      });
      if (!res.ok) throw new Error('Failed to update state');
      const json = await res.json();
      return json?.data;
    },
    delete: async (id) => {
      const res = await fetchWithCsrf(apiUrl(`/api/admin/states/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete state');
    }
  },

  // Data Entry API - Cities
  cities: {
    list: async () => {
      const res = await fetchWithCsrf(apiUrl('/api/admin/cities'));
      if (!res.ok) throw new Error('Failed to fetch cities');
      const json = await res.json();
      return json?.data || [];
    },
    create: async (stateId, name) => {
      const res = await fetchWithCsrf(apiUrl('/api/admin/cities'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state_id: stateId, name })
      });
      if (!res.ok) throw new Error('Failed to create city');
      const json = await res.json();
      return json?.data;
    },
    update: async (id, name, isActive) => {
      const res = await fetchWithCsrf(apiUrl(`/api/admin/cities/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, is_active: isActive })
      });
      if (!res.ok) throw new Error('Failed to update city');
      const json = await res.json();
      return json?.data;
    },
    delete: async (id) => {
      const res = await fetchWithCsrf(apiUrl(`/api/admin/cities/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete city');
    }
  },

  // Support Tickets API
  tickets: {
    list: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.priority && filters.priority !== 'ALL') params.set('priority', filters.priority);
      const res = await fetchWithCsrf(apiUrl(`/api/support/tickets?${params.toString()}`));
      if (!res.ok) throw new Error('Failed to fetch tickets');
      const json = await res.json();
      return json?.tickets || [];
    },

    getById: async (ticketId) => {
      const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}`));
      if (!res.ok) throw new Error('Failed to fetch ticket');
      const json = await res.json();
      return json?.ticket;
    },

    updateStatus: async (ticketId, status) => {
      const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update ticket status');
      const json = await res.json();
      return json?.ticket;
    },

    getMessages: async (ticketId) => {
      const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`));
      if (!res.ok) throw new Error('Failed to fetch ticket messages');
      const json = await res.json();
      return json?.messages || [];
    },

    sendMessage: async (ticketId, message, senderType = 'SUPPORT') => {
      const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sender_type: senderType })
      });
      if (!res.ok) throw new Error('Failed to send message');
      const json = await res.json();
      return json?.message;
    }
  },

  // Vendors API
  vendors: {
    list: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.kycStatus && filters.kycStatus !== 'ALL') params.set('kyc', filters.kycStatus);
      const res = await fetchWithCsrf(apiUrl(`/api/admin/vendors?${params.toString()}`));
      if (!res.ok) throw new Error('Failed to fetch vendors');
      const json = await res.json();
      return json?.vendors || [];
    },

    getById: async (vendorId) => {
      // Fetch a single vendor by ID directly — avoids downloading all vendors
      const res = await fetchWithCsrf(apiUrl(`/api/admin/vendors/${vendorId}`));
      if (!res.ok) {
        // Fallback: search within the list if the single-vendor route is not yet registered
        const listRes = await fetchWithCsrf(apiUrl('/api/admin/vendors'));
        if (!listRes.ok) throw new Error('Failed to fetch vendor');
        const listJson = await listRes.json();
        return (listJson?.vendors || []).find(v => v.id === vendorId);
      }
      const json = await res.json();
      return json?.vendor;
    },

    approveKyc: async (vendorId) => {
      const res = await fetchWithCsrf(apiUrl(`/api/kyc/vendors/${vendorId}/approve`), { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve KYC');
    },

    rejectKyc: async (vendorId, reason) => {
      const res = await fetchWithCsrf(apiUrl(`/api/kyc/vendors/${vendorId}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Failed to reject KYC');
    }
  }
};
