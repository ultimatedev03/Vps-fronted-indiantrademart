import { apiUrl } from '@/lib/apiBase';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

export const employeeApi = {
  // --- AUTH & PROFILE ---
  auth: {
    me: async () => {
      try {
        const res = await fetchWithCsrf(apiUrl('/api/employee/me'));
        if (!res.ok) return null;
        const json = await res.json();
        return json.employee || json.user || null;
      } catch (e) {
        return null;
      }
    },
    
    logout: async () => {
      const res = await fetchWithCsrf(apiUrl('/api/auth/logout'), { method: 'POST' });
      if (!res.ok) throw new Error('Logout failed');
    }
  },

  // --- EMPLOYEE PROFILE ---
  getProfile: async (employeeId) => {
    // If no ID is provided, /api/employee/me or /api/employee/staff/:id should serve it.
    // The Express route /api/employee/me works. If asking for another, use /api/employee/staff
    const path = employeeId ? `/api/employee/staff/${employeeId}` : '/api/employee/me';
    const res = await fetchWithCsrf(apiUrl(path));
    if (!res.ok) throw new Error('Failed to load profile');
    const json = await res.json();
    return json.employee || json.data;
  },

  updateProfile: async (updates) => {
    // In backend separation, updating own profile might hit a specific endpoint or me
    const res = await fetchWithCsrf(apiUrl('/api/employee/me'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    const json = await res.json();
    return json.employee || json.data;
  },

  // --- SUPPORT TICKETS ---
  createTicket: async (ticketData) => {
    const res = await fetchWithCsrf(apiUrl('/api/support/tickets'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketData)
    });
    if (!res.ok) throw new Error('Failed to create ticket');
    const json = await res.json();
    return json?.ticket;
  },

  getTickets: async (role = 'SUPPORT') => {
    const params = new URLSearchParams();
    if (role === 'SALES') params.set('category', 'Sales Inquiry');
    else if (role === 'SUPPORT') params.set('status', 'OPEN'); // simplified mapping for open
    else if (role === 'DATA_ENTRY') params.set('category', 'Data Entry Issue');

    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets?${params.toString()}`));
    if (!res.ok) throw new Error('Failed to fetch tickets');
    const json = await res.json();
    return json?.tickets || [];
  },

  getTicketDetail: async (ticketId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}`));
    if (!res.ok) throw new Error('Failed to fetch ticket');
    const json = await res.json();
    
    const messagesRes = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`));
    const messagesJson = messagesRes.ok ? await messagesRes.json() : { messages: [] };

    return {
      ...(json?.ticket || {}),
      messages: messagesJson?.messages || []
    };
  },

  addTicketMessage: async (ticketId, message) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sender_type: 'SUPPORT' })
    });
    if (!res.ok) throw new Error('Failed to send message');
    const json = await res.json();
    return json?.message;
  },

  closeTicket: async (ticketId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/status`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    if (!res.ok) throw new Error('Failed to close ticket');
    const json = await res.json();
    return json?.ticket;
  },

  updateTicketStatus: async (ticketId, status) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/status`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update ticket status');
    const json = await res.json();
    return json?.ticket;
  },

  // --- DATA ENTRY ---
  createVendor: async (vendorData) => {
    const res = await fetchWithCsrf(apiUrl('/api/admin/vendors'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vendorData)
    });
    if (!res.ok) throw new Error('Failed to create vendor');
    const json = await res.json();
    return json?.data;
  },

  getVendors: async (createdByMe = false) => {
    const res = await fetchWithCsrf(apiUrl('/api/admin/vendors'));
    if (!res.ok) throw new Error('Failed to fetch vendors');
    const json = await res.json();
    return json?.vendors || [];
  },

  updateVendor: async (vendorId, updates) => {
    const res = await fetchWithCsrf(apiUrl(`/api/admin/vendors/${vendorId}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update vendor');
    const json = await res.json();
    return json?.vendor;
  },

  // --- KYC MANAGEMENT ---
  uploadKycDocument: async (vendorId, documentType, file) => {
    // Migration Note: File uploads usually require FormData and backend endpoints.
    // Preserving this as a fetch towards /api/kyc/vendors endpoint exactly.
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('file', file);
    
    const res = await fetch(apiUrl(`/api/kyc/vendors/${vendorId}/upload`), {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Failed to upload KYC document');
    const json = await res.json();
    return json.data;
  },

  getKycDocuments: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/kyc/vendors/${vendorId}/documents`));
    if (!res.ok) throw new Error('Failed to fetch KYC documents');
    const json = await res.json();
    return json?.documents || [];
  },

  submitKyc: async (vendorId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/admin/vendors/${vendorId}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kyc_status: 'SUBMITTED' })
    });
    if (!res.ok) throw new Error('Failed to submit KYC');
    const json = await res.json();
    return json?.vendor;
  },

  // --- CATEGORIES ---
  getHeadCategories: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/dir/categories/heads'));
    if (res.ok) {
      const json = await res.json();
      return json?.data || [];
    }
    return [];
  },

  getSubCategories: async (headCategoryId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/dir/categories/subs?head_id=${headCategoryId}`));
    if (res.ok) {
      const json = await res.json();
      return json?.data || [];
    }
    return [];
  },

  getMicroCategories: async (subCategoryId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/dir/categories/micros?sub_id=${subCategoryId}`));
    if (res.ok) {
      const json = await res.json();
      return json?.data || [];
    }
    return [];
  },

  // --- REQUIREMENTS & SUGGESTIONS ---
  getRequirements: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await fetchWithCsrf(apiUrl(`/api/employee/requirements?${params.toString()}`));
    if (res.ok) {
      const json = await res.json();
      return json.requirements || [];
    }
    throw new Error('API failed');
  },

  updateRequirementStatus: async (requirementId, status) => {
    const res = await fetchWithCsrf(apiUrl(`/api/employee/requirements/${requirementId}/status`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      const json = await res.json();
      return json.requirement;
    }
    throw new Error('API failed');
  },

  getSuggestions: async () => {
    const res = await fetchWithCsrf(apiUrl(`/api/employee/suggestions`));
    if (res.ok) {
      const json = await res.json();
      return json.suggestions || [];
    }
    throw new Error('API failed');
  },

  // --- LEADS ---
  getLeads: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await fetchWithCsrf(apiUrl(`/api/employee/sales/leads?${params.toString()}`));
    if (res.ok) {
      const json = await res.json();
      return json.leads || [];
    }
    throw new Error('API failed');
  },

  createLead: async (leadData) => {
    const res = await fetchWithCsrf(apiUrl(`/api/employee/sales/leads`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData)
    });
    if (res.ok) {
      const json = await res.json();
      return json.lead;
    }
    throw new Error('API failed');
  },

  // --- QUOTES ---
  getQuotes: async () => {
    const res = await fetchWithCsrf(apiUrl('/api/quotation/admin/quotes'));
    if (res.ok) {
      const json = await res.json();
      return json.quotes || [];
    }
    throw new Error('API failed');
  },

  // --- DASHBOARD STATS ---
  getDashboardStats: async () => {
    try {
      const res = await fetchWithCsrf(apiUrl('/api/employee/dashboard/stats'));
      if (res.ok) {
        const json = await res.json();
        return {
          pendingTickets: json?.pendingTickets || 0,
          vendorsCreated: json?.vendorsCreated || 0,
          availableLeads: json?.availableLeads || 0
        };
      }
    } catch {
      // Return zeros if endpoint does not yet exist or fails
    }
    return {
      pendingTickets: 0,
      vendorsCreated: 0,
      availableLeads: 0
    };
  }
};
