import { supabase } from '@/lib/customSupabaseClient';
import { apiUrl } from '@/lib/apiBase';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

export const supportApi = {
  getAllTickets: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.priority && filters.priority !== 'ALL') params.append('priority', filters.priority);
      if (filters.search) params.append('search', filters.search);
      if (filters.scope && filters.scope !== 'ALL') params.append('scope', filters.scope);
      params.append('pageSize', '200');

      const response = await fetchWithCsrf(apiUrl(`/api/support/tickets?${params.toString()}`));
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const { tickets } = await response.json();
      return tickets || [];
    } catch (apiError) {
      console.warn('API fetch failed:', apiError);
      throw apiError;
    }
  },

  // ✅ Messages via API (RLS safe)
  getMessages: async (ticketId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`));
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch messages');
    return data.messages || [];
  },

  sendMessage: async (ticketId, message) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sender_type: 'SUPPORT' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to send message');
    return data.message;
  },

  notifyCustomer: async (ticketId, message) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/notify-customer`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to send customer notification');
    return data;
  },

  escalateTicket: async (ticketId, targetRole, message) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/escalate`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRole, message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to escalate ticket');
    return data;
  },

  getStats: async () => {
    try {
      const response = await fetchWithCsrf(apiUrl(`/api/support/stats`));
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const { stats } = await response.json();
      return {
        open: stats.openTickets || 0,
        inProgress: stats.inProgressTickets || 0,
        closed: stats.closedTickets || 0,
        highPriority: stats.highPriorityTickets || 0,
        resolvedToday: stats.resolvedTickets || 0,
        total: stats.totalTickets || 0
      };
    } catch (error) {
      console.warn('Stats API fetch failed:', error);
      return {
        open: 0,
        inProgress: 0,
        closed: 0,
        highPriority: 0,
        resolvedToday: 0,
        total: 0
      };
    }
  }
};
