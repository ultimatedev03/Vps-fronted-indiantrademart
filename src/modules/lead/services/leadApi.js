// File: src/modules/lead/services/leadApi.js
import { supabase } from '@/lib/customSupabaseClient';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';

// ============ HELPER FUNCTIONS ============

// Get current vendor ID — relies on backend session (no Supabase Auth on client).
const getVendorId = async () => {
  // Backend resolves the vendor from the session cookie / JWT.
  const response = await fetchVendorJson('/api/vendors/me');
  if (response?.vendor?.id) return response.vendor.id;
  throw new Error('Vendor profile not found');
};

const calculateDaysLeft = (endDate) => {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysLeft);
};

const isSubscriptionActive = (subscription) => {
  if (!subscription) return false;
  if (subscription.status !== 'ACTIVE') return false;
  if (!subscription.end_date) return true;
  const daysLeft = calculateDaysLeft(subscription.end_date);
  return daysLeft > 0;
};

const getActiveVendorSubscription = async (vendorId) => {
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from('vendor_plan_subscriptions')
    .select('id, vendor_id, plan_id, status, start_date, end_date')
    .eq('vendor_id', vendorId)
    .eq('status', 'ACTIVE')
    .order('end_date', { ascending: false, nullsFirst: false })
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(10);

  if (error) throw error;
  return (rows || []).find((row) => !row?.end_date || String(row.end_date) > nowIso) || null;
};

// ------------ Lead filtering helpers ------------
const normalizeText = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .trim();

const dedupe = (arr = []) => Array.from(new Set(arr.filter(Boolean)));
const normalizeEmailValue = (value) => String(value || '').trim().toLowerCase();
const isTruthyRegistrationFlag = (value) => {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const pickFirstTextValue = (...values) => {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return null;
};

const mapBuyerMeta = (buyer = {}) => ({
  id: String(buyer?.id || '').trim() || null,
  user_id: String(buyer?.user_id || '').trim() || null,
  full_name: pickFirstTextValue(buyer?.full_name, buyer?.company_name),
  company_name: pickFirstTextValue(buyer?.company_name),
  email: normalizeEmailValue(buyer?.email) || null,
  phone: pickFirstTextValue(buyer?.phone, buyer?.mobile_number, buyer?.mobile),
  avatar_url: pickFirstTextValue(buyer?.avatar_url),
  is_active: typeof buyer?.is_active === 'boolean' ? buyer.is_active : null,
});

const hasBuyerMeta = (buyer = null) =>
  Boolean(
    buyer &&
      (
        pickFirstTextValue(
          buyer?.id,
          buyer?.user_id,
          buyer?.full_name,
          buyer?.company_name,
          buyer?.email,
          buyer?.phone,
          buyer?.avatar_url
        ) ||
        buyer?.is_active === true
      )
  );

const enrichLeadBuyerMeta = async (lead = {}) => {
  if (!lead || typeof lead !== 'object') return lead;

  const existingRegisteredFlag =
    isTruthyRegistrationFlag(lead?.buyer_registered) ||
    isTruthyRegistrationFlag(lead?.is_registered_buyer);
  let buyerMeta = mapBuyerMeta(lead?.buyers || {});
  if (!hasBuyerMeta(buyerMeta)) buyerMeta = null;

  const leadBuyerId = String(lead?.buyer_id || '').trim();
  const leadBuyerEmail = normalizeEmailValue(lead?.buyer_email);
  let isRegisteredBuyer =
    existingRegisteredFlag ||
    Boolean(
      leadBuyerId ||
      String(lead?.buyer_user_id || '').trim() ||
      String(lead?.buyers?.id || '').trim() ||
      String(lead?.buyers?.user_id || '').trim()
    );

  if (!buyerMeta && leadBuyerId) {
    const { data: buyerById, error: buyerByIdError } = await supabase
      .from('buyers')
      .select('id, user_id, full_name, company_name, email, phone, avatar_url, is_active')
      .eq('id', leadBuyerId)
      .maybeSingle();

    if (!buyerByIdError && buyerById) {
      buyerMeta = mapBuyerMeta(buyerById);
      isRegisteredBuyer = true;
    }
  }

  if (!buyerMeta && leadBuyerEmail) {
    const { data: buyerByEmail, error: buyerByEmailError } = await supabase
      .from('buyers')
      .select('id, user_id, full_name, company_name, email, phone, avatar_url, is_active')
      .ilike('email', leadBuyerEmail)
      .maybeSingle();

    if (!buyerByEmailError && buyerByEmail) {
      buyerMeta = mapBuyerMeta(buyerByEmail);
      isRegisteredBuyer = true;
    }
  }

  return {
    ...lead,
    buyer_id: buyerMeta?.id || lead?.buyer_id || null,
    buyer_user_id: buyerMeta?.user_id || lead?.buyer_user_id || null,
    buyer_name: pickFirstTextValue(
      buyerMeta?.full_name,
      lead?.buyer_name,
      lead?.buyerName,
      lead?.client_name,
      lead?.clientName,
      lead?.name
    ),
    buyer_email: buyerMeta?.email || leadBuyerEmail || null,
    buyer_phone: pickFirstTextValue(
      buyerMeta?.phone,
      lead?.buyer_phone,
      lead?.buyerPhone,
      lead?.phone
    ),
    company_name: pickFirstTextValue(buyerMeta?.company_name, lead?.company_name),
    buyer_registered: isRegisteredBuyer,
    is_registered_buyer: isRegisteredBuyer,
    buyers: buyerMeta || lead?.buyers || null,
  };
};

const fetchVendorJson = async (path, options = {}) => {
  const res = await fetchWithCsrf(apiUrl(path), options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error || data?.message || 'Request failed';
    const error = new Error(message);
    error.status = res.status;
    error.code = data?.code || null;
    error.payload = data;
    throw error;
  }
  return data;
};

// Pull city/state out of common lead fields
const extractLocation = (lead = {}) => {
  const city = (lead.city || lead.city_name || '').toString().trim();
  const state = (lead.state || lead.state_name || '').toString().trim();

  if (city || state) return { city, state };

  const raw = (lead.location || '').toString();
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0], state: parts.slice(1).join(', ') };
  if (parts.length === 1) return { city: parts[0], state: '' };
  return { city: '', state: '' };
};

const buildLeadTokens = (lead = {}) =>
  dedupe([
    lead.category,
    lead.category_slug,
    lead.product_interest,
    lead.description,
    lead.category_name,
    lead.head_category,
    lead.sub_category,
    lead.product_name,
    lead.product,
    lead.service_name,
    lead.title,
    lead.requirement_title,
  ].map(normalizeText));

const fuzzyMatch = (value, target) => {
  if (!value || !target) return false;
  return value.includes(target) || target.includes(value);
};

const matchesAny = (leadTokens, allowedSet) => {
  if (!allowedSet || allowedSet.size === 0) return false;
  for (const token of leadTokens) {
    for (const allowed of allowedSet) {
      if (fuzzyMatch(token, allowed)) return true;
    }
  }
  return false;
};

// Load vendor-selected categories/products/states/cities for filtering
const loadVendorLeadContext = async (vendorId) => {
  const ctx = {
    categorySet: new Set(),
    productSet: new Set(),
    microIdSet: new Set(),
    headIdSet: new Set(),
    subIdSet: new Set(),
    stateSet: new Set(),
    citySet: new Set(),
    stateIdSet: new Set(),
    cityIdSet: new Set(),
    autoLeadFilter: true,
    minBudget: null,
    maxBudget: null,
  };

  try {
    const { data: prefs } = await supabase
      .from('vendor_preferences')
      .select('preferred_micro_categories, preferred_states, preferred_cities, auto_lead_filter, min_budget, max_budget')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    const preferredCategoryIds = prefs?.preferred_micro_categories || [];
    const preferredStateIds = prefs?.preferred_states || [];
    const preferredCityIds = prefs?.preferred_cities || [];

    ctx.autoLeadFilter = prefs?.auto_lead_filter !== false;
    const minBudgetNum = Number(prefs?.min_budget);
    const maxBudgetNum = Number(prefs?.max_budget);
    ctx.minBudget = Number.isFinite(minBudgetNum) ? minBudgetNum : null;
    ctx.maxBudget = Number.isFinite(maxBudgetNum) ? maxBudgetNum : null;

    preferredStateIds.forEach((id) => ctx.stateIdSet.add(id));
    preferredCityIds.forEach((id) => ctx.cityIdSet.add(id));

    if (preferredCategoryIds.length) {
      const { data: prefMicroRows } = await supabase
        .from('micro_categories')
        .select('id, name, sub_categories(id, name, head_categories(id, name))')
        .in('id', preferredCategoryIds);
      prefMicroRows?.forEach((row) => {
        if (row?.id) ctx.microIdSet.add(row.id);
        if (row?.name) ctx.categorySet.add(normalizeText(row.name));
        const sub = row?.sub_categories;
        if (sub?.id) ctx.subIdSet.add(sub.id);
        if (sub?.name) ctx.categorySet.add(normalizeText(sub.name));
        const head = sub?.head_categories;
        if (head?.id) ctx.headIdSet.add(head.id);
        if (head?.name) ctx.categorySet.add(normalizeText(head.name));
      });

      const { data: headCats } = await supabase
        .from('head_categories')
        .select('id, name')
        .in('id', preferredCategoryIds);
      headCats?.forEach((row) => {
        if (row?.id) ctx.headIdSet.add(row.id);
        if (row?.name) ctx.categorySet.add(normalizeText(row.name));
      });
    }

    // Vendor products -> micro category names + product names
    const { data: products } = await supabase
      .from('products')
      .select('name, micro_category_id, head_category_id, sub_category_id')
      .eq('vendor_id', vendorId)
      .eq('status', 'ACTIVE');

    const productNames = dedupe(products?.map((p) => p?.name) || []);
    productNames.forEach((name) => ctx.productSet.add(normalizeText(name)));

    const microIds = dedupe(products?.map((p) => p?.micro_category_id).filter(Boolean) || []);
    microIds.forEach((id) => ctx.microIdSet.add(id));
    const headIds = dedupe(products?.map((p) => p?.head_category_id).filter(Boolean) || []);
    headIds.forEach((id) => ctx.headIdSet.add(id));
    const subIds = dedupe(products?.map((p) => p?.sub_category_id).filter(Boolean) || []);
    subIds.forEach((id) => ctx.subIdSet.add(id));
    if (microIds.length) {
      const { data: productMicroRows } = await supabase
        .from('micro_categories')
        .select('id, name, sub_categories(id, name, head_categories(id, name))')
        .in('id', microIds);

      productMicroRows?.forEach((row) => {
        if (row?.name) ctx.categorySet.add(normalizeText(row.name));
        const sub = row?.sub_categories;
        if (sub?.id) ctx.subIdSet.add(sub.id);
        if (sub?.name) ctx.categorySet.add(normalizeText(sub.name));
        const head = sub?.head_categories;
        if (head?.id) ctx.headIdSet.add(head.id);
        if (head?.name) ctx.categorySet.add(normalizeText(head.name));
      });
    }

    if (preferredStateIds.length) {
      const { data: stateRows } = await supabase
        .from('states')
        .select('id, name')
        .in('id', preferredStateIds);
      stateRows?.forEach((row) => {
        if (row?.id) ctx.stateIdSet.add(row.id);
        if (row?.name) ctx.stateSet.add(normalizeText(row.name));
      });
    }

    if (preferredCityIds.length) {
      const { data: cityRows } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', preferredCityIds);
      cityRows?.forEach((row) => {
        if (row?.id) ctx.cityIdSet.add(row.id);
        if (row?.name) ctx.citySet.add(normalizeText(row.name));
      });
    }
  } catch (e) {
    console.error('[leadApi] Failed to load vendor lead context:', e);
  }

  return ctx;
};

export const leadApi = {
  // --- LEADS API ---
  list: async (filters = {}) => {
    let query = supabase
      .from('leads')
      .select('*');

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId);
    if (filters.category) query = query.eq('category', filters.category);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 100);
    if (error) throw error;
    return data || [];
  },

  listActive: async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'AVAILABLE')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  listByVendor: async (vendorId) => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  get: async (id) => {
    const leadId = String(id || '').trim();
    if (!leadId) throw new Error('Lead id is required');

    const payload = await fetchVendorJson(`/api/vendors/me/leads/${encodeURIComponent(leadId)}`);
    if (payload?.lead) return payload.lead;
    throw new Error('Lead not found');
  },

  getStatusHistory: async (id) => {
    const leadId = String(id || '').trim();
    if (!leadId) throw new Error('Lead id is required');

    const payload = await fetchVendorJson(
      `/api/vendors/me/leads/${encodeURIComponent(leadId)}/status-history`
    );

    return {
      lead_id: payload?.lead_id || leadId,
      current_status: payload?.current_status || 'ACTIVE',
      history: Array.isArray(payload?.history) ? payload.history : [],
      is_direct: Boolean(payload?.is_direct),
      is_purchased: Boolean(payload?.is_purchased),
    };
  },

  updateLifecycleStatus: async (id, { status, note } = {}) => {
    const leadId = String(id || '').trim();
    if (!leadId) throw new Error('Lead id is required');

    const normalizedStatus = String(status || '').trim().toUpperCase();
    if (!['ACTIVE', 'VIEWED', 'CLOSED'].includes(normalizedStatus)) {
      throw new Error('Invalid status');
    }

    const noteText = String(note ?? '').trim();
    const payload = await fetchVendorJson(
      `/api/vendors/me/leads/${encodeURIComponent(leadId)}/status`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: normalizedStatus,
          note: noteText || null,
        }),
      }
    );

    return payload;
  },

  getLeadStats: async () => {
    const payload = await fetchVendorJson('/api/vendors/me/lead-stats');
    return payload?.stats || null;
  },

  create: async (leadData) => {
    const res = await fetchWithCsrf(apiUrl('/api/vendors/me/leads-create'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to create lead');
    return json?.lead || json?.data;
  },

  update: async (id, updates) => {
    const res = await fetchWithCsrf(apiUrl(`/api/vendors/me/leads/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to update lead');
    return json?.lead || json?.data;
  },

  updateStatus: async (id, status) => {
    return leadApi.updateLifecycleStatus(id, { status });
  },

  delete: async (id) => {
    const res = await fetchWithCsrf(apiUrl(`/api/vendors/me/leads/${encodeURIComponent(id)}`), { method: 'DELETE' });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Failed to delete lead'); }
  },

  // --- LEAD CONTACTS API ---
  contacts: {
    list: async (leadId) => {
      const normalizedLeadId = String(leadId || '').trim();
      if (!normalizedLeadId) return [];
      const payload = await fetchVendorJson(
        `/api/vendors/me/leads/${encodeURIComponent(normalizedLeadId)}/contacts`
      );
      return Array.isArray(payload?.contacts) ? payload.contacts : [];
    },

    getByVendor: async (vendorId, leadId) => {
      return leadApi.contacts.list(leadId);
    },

    create: async (leadId, vendorOrContactData, maybeContactData) => {
      const normalizedLeadId = String(leadId || '').trim();
      if (!normalizedLeadId) throw new Error('Lead id is required');

      const contactData =
        maybeContactData && typeof maybeContactData === 'object'
          ? maybeContactData
          : vendorOrContactData && typeof vendorOrContactData === 'object'
            ? vendorOrContactData
            : {};

      const payload = await fetchVendorJson(
        `/api/vendors/me/leads/${encodeURIComponent(normalizedLeadId)}/contacts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_type: contactData?.contact_type || contactData?.contactType,
            notes: contactData?.notes || '',
          }),
        }
      );

      return payload?.contact || null;
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('lead_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    updateStatus: async (id, status) => {
      const validStatuses = ['PENDING', 'CONNECTED', 'NO_RESPONSE', 'CONVERTED'];
      if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);

      const { data, error } = await supabase
        .from('lead_contacts')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    delete: async (id) => {
      const res = await fetchWithCsrf(apiUrl(`/api/vendors/me/contacts/${encodeURIComponent(id)}`), { method: 'DELETE' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Failed to delete contact'); }
    },

    getStats: async (leadId) => {
      const contacts = await leadApi.contacts.list(leadId);
      const total = contacts.length;
      const converted = contacts.filter((row) => String(row?.status || '').toUpperCase() === 'CONVERTED').length;
      const noResponse = contacts.filter((row) => String(row?.status || '').toUpperCase() === 'NO_RESPONSE').length;

      return {
        total,
        converted,
        noResponse
      };
    }
  },

  // --- LEAD PURCHASES API ---
  purchases: {
    list: async (vendorId) => {
      // FIX: Don't specify columns to avoid RLS violation
      const { data, error } = await supabase
        .from('lead_purchases')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      
      // Join with leads manually (batch query to avoid single-row coercion errors)
      if (data && data.length > 0) {
        const leadIds = Array.from(new Set((data || []).map((row) => row?.lead_id).filter(Boolean)));
        let leadById = new Map();

        if (leadIds.length) {
          const { data: leadRows, error: leadRowsErr } = await supabase
            .from('leads')
            .select('*')
            .in('id', leadIds);
          if (leadRowsErr) throw leadRowsErr;
          leadById = new Map((leadRows || []).map((lead) => [String(lead.id), lead]));
        }

        for (let i = 0; i < data.length; i++) {
          const lead = leadById.get(String(data[i]?.lead_id || '')) || null;
          data[i].lead = lead;
          data[i].leads = lead; // Support both naming conventions
        }
      }
      return data || [];
    },

    get: async (id) => {
      const { data, error } = await supabase
        .from('lead_purchases')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      
      if (data) {
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', data.lead_id)
          .single();
        data.lead = lead;
        data.leads = lead;
      }
      return data;
    },

    create: async (vendorId, leadId, amountOrOptions) => {
      const normalizedLeadId = String(leadId || '').trim();
      if (!normalizedLeadId) throw new Error('Lead id is required');

      const options =
        amountOrOptions && typeof amountOrOptions === 'object' && !Array.isArray(amountOrOptions)
          ? amountOrOptions
          : { amount: amountOrOptions };
      const parsedAmount = Number(options?.amount);
      const amountPayload = Number.isFinite(parsedAmount) ? parsedAmount : undefined;
      const modeRaw = String(options?.mode || 'AUTO').trim().toUpperCase();
      const mode = ['AUTO', 'USE_WEEKLY', 'BUY_EXTRA', 'PAID'].includes(modeRaw)
        ? modeRaw
        : 'AUTO';

      const payload = await fetchVendorJson(`/api/vendors/me/leads/${encodeURIComponent(normalizedLeadId)}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          amountPayload === undefined ? { mode } : { mode, amount: amountPayload }
        ),
      });
      return payload?.purchase || payload;
    },

    delete: async (id) => {
      const res = await fetchWithCsrf(apiUrl(`/api/vendors/me/purchases/${encodeURIComponent(id)}`), { method: 'DELETE' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Failed to delete purchase'); }
    },

    getStats: async (vendorId) => {
      const { count: totalPurchases } = await supabase
        .from('lead_purchases')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId);

      const { data: purchases } = await supabase
        .from('lead_purchases')
        .select('amount')
        .eq('vendor_id', vendorId);

      const totalAmount = purchases?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      return {
        totalPurchases: totalPurchases || 0,
        totalSpent: totalAmount
      };
    }
  },

  // --- MARKETPLACE API (merged from leadsMarketplaceApi) ---
  marketplace: {
    // Get leads for marketplace (excludes direct leads with vendor_id and purchased leads)
    listAvailable: async (options = {}) => {
      const withMeta = options && typeof options === 'object' && options.withMeta === true;
      const response = await fetchVendorJson('/api/vendors/me/marketplace-leads');
      const leads = Array.isArray(response?.leads) ? response.leads : [];
      const subscriptionRequired = Boolean(response?.subscription_required);
      const message = String(
        response?.message ||
          (subscriptionRequired ? 'Active subscription required to access marketplace leads.' : '')
      ).trim();
      if (withMeta) {
        return {
          leads,
          subscription_required: subscriptionRequired,
          message,
          filter_applied: Boolean(response?.filter_applied),
          filter_scope: String(response?.filter_scope || '').trim(),
          filter_message: String(response?.filter_message || '').trim(),
          filter_match_count: Number(response?.filter_match_count || 0),
          total_eligible: Number(response?.total_eligible || 0),
        };
      }
      return leads;
    },

    // Get buyer-created direct leads (seller receives directly from buyer, not marketplace)
    listDirect: async () => {
      const vendorId = await getVendorId();
      
      // Get leads that were created by this vendor (direct from buyer)
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('status', 'AVAILABLE')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    // Get My Leads (purchased + direct + proposals)
    getMyLeads: async () => {
      const { leads } = await fetchVendorJson('/api/vendors/me/leads');
      return Array.isArray(leads) ? leads : [];
    }
  }
};
