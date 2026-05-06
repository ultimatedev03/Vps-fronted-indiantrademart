import { supabase } from '@/lib/customSupabaseClient';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import { resolveBuyerId, resolveBuyerProfile, getAuthUserOrThrow } from '@/modules/buyer/services/buyerSession';
import { MIN_IMAGE_UPLOAD_BYTES, validateImageFile } from '@/shared/utils/fileValidation';

// Helper to get current buyer ID from auth user
const getBuyerId = async () => {
  return resolveBuyerId({ required: true });
};

// Helper: current auth user
const getAuthUser = async () => {
  return getAuthUserOrThrow();
};

// Helper: remove undefined keys
const stripUndefined = (obj) => {
  const cleaned = { ...obj };
  Object.keys(cleaned).forEach((k) => cleaned[k] === undefined && delete cleaned[k]);
  return cleaned;
};

const omitKeys = (obj, keys = []) =>
  stripUndefined(
    Object.fromEntries(
      Object.entries(obj || {}).filter(([key, value]) => !keys.includes(key) && value !== undefined)
    )
  );

const normalizeOptionalText = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const lowered = text.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined') return null;
  return text;
};

const normalizeVendorId = (value) => normalizeOptionalText(value);

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );

const missingColumnFromError = (error) => {
  const raw = `${error?.message || ''} ${error?.details || ''}`;
  const quotedMatch = raw.match(/column\s+"([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return String(quotedMatch[1] || '').trim();
  }
  const schemaCacheMatch = raw.match(/could not find the ['"]([^'"]+)['"] column/i);
  if (schemaCacheMatch?.[1]) {
    return String(schemaCacheMatch[1] || '').trim();
  }
  const code = String(error?.code || '').toUpperCase();
  if (code !== '42703' && code !== 'PGRST204') return '';
  const match = raw.match(/column\s+([^ .]+)\s+/i);
  return String(match?.[1] || '').trim();
};

const makePayloadSignature = (payload) =>
  JSON.stringify(
    Object.keys(payload || {})
      .sort()
      .reduce((acc, key) => {
        acc[key] = payload[key];
        return acc;
      }, {})
  );

const insertSingleWithFallback = async ({ table, payload, select = '*', dropKeySets = [] }) => {
  const attempts = [];
  const seen = new Set();

  const enqueue = (candidate) => {
    const cleaned = stripUndefined(candidate || {});
    if (!Object.keys(cleaned).length) return;
    const signature = makePayloadSignature(cleaned);
    if (seen.has(signature)) return;
    seen.add(signature);
    attempts.push(cleaned);
  };

  enqueue(payload);
  dropKeySets.forEach((keys) => enqueue(omitKeys(payload, keys)));

  let lastError = null;

  while (attempts.length > 0) {
    const candidate = attempts.shift();
    const { data, error } = await supabase
      .from(table)
      .insert([candidate])
      .select(select)
      .maybeSingle();

    if (!error) return data;

    lastError = error;
    console.warn(`[${table} insert] Failed:`, error?.message || error, candidate);

    const missingColumn = missingColumnFromError(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(candidate, missingColumn)) {
      enqueue(omitKeys(candidate, [missingColumn]));
    }
  }

  throw lastError || new Error(`Failed to insert ${table}`);
};

const MESSAGE_MARKERS = {
  edited: /^::itm_edited::$/i,
  deliveredBuyer: /^::itm_delivered_buyer::(.+)$/i,
  deliveredVendor: /^::itm_delivered_vendor::(.+)$/i,
  readBuyer: /^::itm_read_buyer::(.+)$/i,
  readVendor: /^::itm_read_vendor::(.+)$/i,
};

const normalizeProposalMessage = (row = {}) => {
  const lines = String(row?.message || '').replace(/\r\n/g, '\n').split('\n');
  const contentLines = [];
  let isEdited = false;

  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (
      MESSAGE_MARKERS.edited.test(trimmed) ||
      MESSAGE_MARKERS.deliveredBuyer.test(trimmed) ||
      MESSAGE_MARKERS.deliveredVendor.test(trimmed) ||
      MESSAGE_MARKERS.readBuyer.test(trimmed) ||
      MESSAGE_MARKERS.readVendor.test(trimmed)
    ) {
      if (MESSAGE_MARKERS.edited.test(trimmed)) {
        isEdited = true;
      }
      continue;
    }
    contentLines.push(line);
  }

  return {
    ...row,
    message: contentLines.join('\n').trimEnd(),
    is_edited: isEdited || Boolean(row?.is_edited),
  };
};

const insertLeadSafely = async (leadPayload) => {
  return insertSingleWithFallback({
    table: 'leads',
    payload: leadPayload,
    select: '*',
    dropKeySets: [
      ['updated_at'],
      ['buyer_user_id'],
      ['buyer_id'],
      ['buyer_id', 'buyer_user_id'],
      ['buyer_id', 'buyer_user_id', 'proposal_id'],
      [
        'updated_at',
        'buyer_id',
        'buyer_user_id',
        'proposal_id',
        'category_slug',
        'category',
        'location',
        'vendor_email',
        'city',
        'state',
        'pincode',
        'micro_category_id',
        'sub_category_id',
        'head_category_id',
        'state_id',
        'city_id',
        'source',
      ],
    ],
  });
};

const insertProposalSafely = async (proposalPayload) => {
  return insertSingleWithFallback({
    table: 'proposals',
    payload: proposalPayload,
    select: '*',
    dropKeySets: [
      ['required_by_date'],
      ['required_by_date', 'buyer_email'],
      [
        'required_by_date',
        'buyer_email',
        'category',
        'category_slug',
        'micro_category_id',
        'sub_category_id',
        'head_category_id',
        'state_id',
        'city_id',
        'location',
        'pincode',
        'vendor_email',
      ],
    ],
  });
};

export const buyerApi = {
  // --- AUTH & PROFILE ---
  auth: {
    me: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const buyer = await resolveBuyerProfile({ required: false });

      return { ...user, ...buyer };
    },

    logout: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
  },

  // --- PROFILE MANAGEMENT ---
  getProfile: async (buyerId) => {
    const buyer = await resolveBuyerProfile({ required: true });
    if (buyerId && buyer?.id && String(buyer.id) !== String(buyerId)) {
      throw new Error('Buyer profile mismatch');
    }
    return buyer;
  },

  updateProfile: async (updates) => {
    // Convert camelCase to snake_case for backend update payload
    const payload = {};
    for (const [key, value] of Object.entries(updates || {})) {
      if (key.includes('_') || ['id', 'user_id', 'created_at', 'updated_at'].includes(key)) {
        payload[key] = value;
      } else {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        payload[snakeKey] = value;
      }
    }

    const res = await fetchWithCsrf(apiUrl('/api/auth/buyer/profile'), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || 'Failed to update profile');
    }
    return json?.buyer || null;
  },

  uploadAvatar: async (file) => {
    validateImageFile(file, {
      minBytes: MIN_IMAGE_UPLOAD_BYTES,
      maxBytes: 5 * 1024 * 1024,
      label: 'Profile image',
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
      mimeMessage: 'Unsupported image type. Use JPG/PNG/WebP/GIF.',
    });

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    const res = await fetchWithCsrf(apiUrl('/api/auth/buyer/profile/avatar'), {
      method: 'POST',
      body: JSON.stringify({
        file_name: file.name || 'avatar',
        content_type: file.type || '',
        data_url: dataUrl,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      throw new Error(json?.error || 'Failed to upload avatar');
    }
    return String(json?.publicUrl || '').trim();
  },

  // --- STATISTICS ---
  getStats: async (buyerId) => {
    let authUser = null;
    try {
      authUser = await getAuthUser();
    } catch {
      authUser = null;
    }

    if (!buyerId) {
      buyerId = await getBuyerId();
    }

    const unreadMessagesPromise = (async () => {
      try {
        const res = await fetchWithCsrf(apiUrl('/api/quotation/unread-count'));
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.success) {
          const n = Number(json?.unread || 0);
          return Number.isFinite(n) && n > 0 ? n : 0;
        }
      } catch {
        // fallback below
      }

      if (!authUser?.id) return 0;
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', authUser.id)
          .in('type', ['PROPOSAL_MESSAGE', 'SUPPORT_MESSAGE'])
          .eq('is_read', false);
        if (!error) return count || 0;
      } catch {
        // ignore
      }
      return 0;
    })();

    const [proposalsRes, ticketsRes, favoritesRes, unreadMessagesRes] = await Promise.allSettled([
      supabase
        .from('proposals')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', buyerId)
        .eq('status', 'SENT'),
      buyerApi.getTickets(buyerId),
      buyerApi.getFavorites(buyerId),
      unreadMessagesPromise,
    ]);

    const proposals =
      proposalsRes.status === 'fulfilled'
        ? (proposalsRes.value?.count || 0)
        : 0;
    const tickets =
      ticketsRes.status === 'fulfilled'
        ? (Array.isArray(ticketsRes.value)
            ? ticketsRes.value.filter((t) => String(t?.status || '').toUpperCase() !== 'CLOSED').length
            : 0)
        : 0;
    const favorites =
      favoritesRes.status === 'fulfilled'
        ? (Array.isArray(favoritesRes.value) ? favoritesRes.value.length : 0)
        : 0;
    const unreadMessages =
      unreadMessagesRes.status === 'fulfilled'
        ? (Number(unreadMessagesRes.value) || 0)
        : 0;

    return {
      activeProposals: proposals || 0,
      openTickets: tickets || 0,
      favoriteVendors: favorites || 0,
      unreadMessages: unreadMessages || 0,
    };
  },

  // --- PROPOSALS ---
  createProposal: async (proposalData) => {
    const normalizedCategory = normalizeOptionalText(proposalData?.category);
    const normalizedCategoryName =
      normalizeOptionalText(proposalData?.category_name) ||
      normalizeOptionalText(proposalData?.product_name) ||
      normalizedCategory;
    const normalizedTitle =
      normalizeOptionalText(proposalData?.title) ||
      normalizeOptionalText(proposalData?.product_name) ||
      normalizedCategoryName ||
      normalizedCategory;
    const normalizedProductName =
      normalizeOptionalText(proposalData?.product_name) ||
      normalizedCategoryName ||
      normalizedCategory ||
      normalizedTitle;
    const normalizedDescription = normalizeOptionalText(proposalData?.description);
    const normalizedState = normalizeOptionalText(proposalData?.state);
    const normalizedCity = normalizeOptionalText(proposalData?.city);
    const normalizedLocation =
      normalizeOptionalText(proposalData?.location) ||
      [normalizedCity, normalizedState].filter(Boolean).join(', ') ||
      null;
    const normalizedStateId = normalizeOptionalText(proposalData?.state_id);
    const normalizedCityId = normalizeOptionalText(proposalData?.city_id);
    const normalizedPincode = normalizeOptionalText(proposalData?.pincode);
    const normalizedCategorySlug = normalizeOptionalText(proposalData?.category_slug);
    const normalizedMicroCategoryId = normalizeOptionalText(proposalData?.micro_category_id);
    const normalizedSubCategoryId = normalizeOptionalText(proposalData?.sub_category_id);
    const normalizedHeadCategoryId = normalizeOptionalText(proposalData?.head_category_id);
    const normalizedRequiredByDate = normalizeOptionalText(proposalData?.required_by_date);
    const normalizedQuantity = Number(proposalData?.quantity);
    const normalizedBudget = Number(proposalData?.budget);

    if (!normalizedTitle || !normalizedProductName || !normalizedCategory) {
      throw new Error('Category and product details are required');
    }

    if (!normalizedMicroCategoryId) {
      throw new Error('Micro category is required');
    }

    if (!normalizedStateId || !normalizedCityId || !normalizedCity || !normalizedPincode) {
      throw new Error('Delivery state, city, and pincode are required');
    }

    if (!/^\d{6}$/.test(normalizedPincode)) {
      throw new Error('Please enter a valid 6-digit pincode');
    }

    if (!normalizedDescription || normalizedDescription.length < 10) {
      throw new Error('Requirement details must be at least 10 characters');
    }

    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    if (!Number.isFinite(normalizedBudget) || normalizedBudget <= 0) {
      throw new Error('Budget must be greater than 0');
    }

    const urlVendorId =
      typeof window !== 'undefined'
        ? normalizeVendorId(
            new URLSearchParams(window.location.search).get('vendorId') ||
              new URLSearchParams(window.location.search).get('vendor_id')
          )
        : null;

    let resolvedVendorId =
      normalizeVendorId(proposalData?.vendor_id) ||
      normalizeVendorId(proposalData?.vendorId) ||
      normalizeVendorId(proposalData?.selected_vendor_id) ||
      normalizeVendorId(proposalData?.selectedVendorId) ||
      urlVendorId ||
      null;
    let resolvedVendorEmail = normalizeOptionalText(
      proposalData?.vendor_email || proposalData?.selected_vendor_email
    );

    if (!resolvedVendorId && resolvedVendorEmail) {
      const { data: vendorByEmail, error: vendorLookupError } = await supabase
        .from('vendors')
        .select('id, email')
        .eq('email', String(resolvedVendorEmail).toLowerCase())
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vendorLookupError) throw vendorLookupError;
      resolvedVendorId = normalizeVendorId(vendorByEmail?.id);
      resolvedVendorEmail = normalizeOptionalText(vendorByEmail?.email) || resolvedVendorEmail;
    }

    const user = await getAuthUser();
    let buyerProfile = null;
    try {
      buyerProfile = await resolveBuyerProfile({ required: false });
    } catch {
      buyerProfile = null;
    }
    let buyerId = buyerProfile?.id || null;
    if (!buyerId) {
      try {
        buyerId = await resolveBuyerId({ required: false });
      } catch {
        buyerId = null;
      }
    }

    // Get buyer profile for contact details
    // Determine buyer name and company
    const buyerName = buyerProfile?.company_name || user?.user_metadata?.full_name || user?.email || 'Buyer';
    const buyerCompany = buyerProfile?.company_name || user?.user_metadata?.full_name || '';
    const buyerEmail = String(user?.email || '').trim().toLowerCase();
    const buyerPhone = buyerProfile?.phone || buyerProfile?.mobile_number || '';
    const createdAt = new Date().toISOString();

    if (resolvedVendorEmail) {
      resolvedVendorEmail = String(resolvedVendorEmail).toLowerCase().trim();
    }

    const payload = {
      buyer_id: buyerId,
      buyer_email: null,
      vendor_id: resolvedVendorId,
      vendor_email: resolvedVendorEmail,
      title: normalizedTitle,
      product_name: normalizedProductName,
      category: normalizedCategory,
      category_slug: normalizedCategorySlug,
      micro_category_id: normalizedMicroCategoryId,
      sub_category_id: normalizedSubCategoryId,
      head_category_id: normalizedHeadCategoryId,
      state_id: normalizedStateId,
      city_id: normalizedCityId,
      location: normalizedLocation,
      pincode: normalizedPincode,
      quantity: normalizedQuantity,
      budget: normalizedBudget,
      required_by_date: normalizedRequiredByDate,
      description: normalizedDescription,
      status: 'SENT',
      created_at: createdAt,
      updated_at: createdAt,
    };

    const requestPayload = stripUndefined({
      title: payload.title,
      product_name: payload.product_name,
      product_interest: payload.product_name,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      company_name: buyerCompany,
      description: payload.description,
      message: payload.description,
      quantity: payload.quantity,
      budget: payload.budget,
      category: normalizedCategory,
      category_name: normalizedCategoryName,
      category_slug: normalizedCategorySlug,
      location: normalizedLocation,
      state: normalizedState,
      state_id: normalizedStateId,
      city: normalizedCity,
      city_id: normalizedCityId,
      pincode: normalizedPincode,
      micro_category_id: normalizedMicroCategoryId,
      sub_category_id: normalizedSubCategoryId,
      head_category_id: normalizedHeadCategoryId,
      required_by_date: normalizedRequiredByDate,
      vendor_email: resolvedVendorEmail,
      captcha_token: normalizeOptionalText(proposalData?.captcha_token || proposalData?.captchaToken),
      captcha_action: normalizeOptionalText(proposalData?.captcha_action || proposalData?.captchaAction),
    });

    // Direct vendor proposal path must go through backend API
    // to bypass RLS and ensure vendor sees it in "Received Requests".
    if (payload.vendor_id) {
      try {
        const directProposalRes = await fetchWithCsrf(apiUrl(`/api/vendors/${payload.vendor_id}/leads`), {
          method: 'POST',
          body: JSON.stringify(requestPayload),
        });

        const directProposalJson = await directProposalRes.json().catch(() => ({}));
        if (!directProposalRes.ok || !directProposalJson?.success) {
          throw new Error(directProposalJson?.error || 'Failed to create proposal request');
        }

        const createdProposal = directProposalJson?.proposal || null;
        if (createdProposal) return createdProposal;

        return {
          id: null,
          vendor_id: payload.vendor_id,
          vendor_email: payload.vendor_email,
          buyer_id: buyerId,
          title: payload.title,
          product_name: payload.product_name,
          category: payload.category,
          category_slug: payload.category_slug,
          micro_category_id: payload.micro_category_id,
          sub_category_id: payload.sub_category_id,
          head_category_id: payload.head_category_id,
          location: payload.location,
          state_id: payload.state_id,
          city_id: payload.city_id,
          pincode: payload.pincode,
          quantity: payload.quantity,
          budget: payload.budget,
          description: payload.description,
          status: 'SENT',
          created_at: createdAt,
        };
      } catch (directProposalError) {
        throw new Error(
          directProposalError?.message || 'Failed to create proposal request'
        );
      }
    }

    // Marketplace proposal path through backend to avoid RLS/schema drift issues.
    try {
      const marketplaceProposalRes = await fetchWithCsrf(apiUrl('/api/vendors/marketplace/leads'), {
        method: 'POST',
        body: JSON.stringify(requestPayload),
      });

      const marketplaceProposalJson = await marketplaceProposalRes.json().catch(() => ({}));
      if (marketplaceProposalRes.ok && marketplaceProposalJson?.success) {
        if (marketplaceProposalJson?.proposal) {
          return marketplaceProposalJson.proposal;
        }
        return {
          id: null,
          vendor_id: null,
          vendor_email: payload.vendor_email,
          buyer_id: buyerId,
          title: payload.title,
          product_name: payload.product_name,
          category: payload.category,
          category_slug: payload.category_slug,
          micro_category_id: payload.micro_category_id,
          sub_category_id: payload.sub_category_id,
          head_category_id: payload.head_category_id,
          location: payload.location,
          state_id: payload.state_id,
          city_id: payload.city_id,
          pincode: payload.pincode,
          quantity: payload.quantity,
          budget: payload.budget,
          description: payload.description,
          status: 'SENT',
          created_at: createdAt,
        };
      }
      throw new Error(
        marketplaceProposalJson?.error || 'Failed to post requirement'
      );
    } catch (marketplaceError) {
      throw new Error(
        marketplaceError?.message || 'Failed to post requirement'
      );
    }

    if (!buyerId) {
      throw new Error('Buyer profile not found');
    }

    const proposal =
      (await insertProposalSafely(payload)) || {
        id: null,
        vendor_id: payload.vendor_id,
        vendor_email: payload.vendor_email,
        buyer_id: payload.buyer_id,
        title: payload.title,
        product_name: payload.product_name,
        category: payload.category,
        category_slug: payload.category_slug,
        micro_category_id: payload.micro_category_id,
        sub_category_id: payload.sub_category_id,
        head_category_id: payload.head_category_id,
        location: payload.location,
        state_id: payload.state_id,
        city_id: payload.city_id,
        pincode: payload.pincode,
        quantity: payload.quantity,
        budget: payload.budget,
        description: payload.description,
        status: payload.status,
        created_at: payload.created_at,
      };

    // ✅ Lead create (Direct lead OR Marketplace lead)
    // - Direct lead: vendor_id set
    // - Marketplace lead: vendor_id null
    const leadPayload = {
      vendor_id: payload.vendor_id || null,
      vendor_email: payload.vendor_email || null,

      // ✅ buyer mapping (agar columns exist)
      buyer_id: buyerId,
      buyer_user_id: user?.id || null,

      title: payload.title,
      product_name: payload.product_name,
      category: normalizedCategory,
      category_slug: normalizedCategorySlug,
      micro_category_id: normalizedMicroCategoryId,
      sub_category_id: normalizedSubCategoryId,
      head_category_id: normalizedHeadCategoryId,
      quantity: payload.quantity,
      budget: payload.budget,
      location: normalizedLocation,
      city: normalizedCity,
      state: normalizedState,
      state_id: normalizedStateId,
      city_id: normalizedCityId,
      pincode: normalizedPincode,
      description: payload.description,
      message: payload.description,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      company_name: buyerCompany,
      source: payload.vendor_id ? 'DIRECT' : 'MARKETPLACE',
      status: 'AVAILABLE',
      created_at: createdAt,
      proposal_id: proposal?.id || null,
    };

    if (!leadPayload.buyer_name || !leadPayload.buyer_email) {
      console.warn('Lead missing buyer details:', {
        buyer_name: leadPayload.buyer_name,
        buyer_email: leadPayload.buyer_email
      });
    }

    let leadData = null;
    let createdThroughVendorLeadApi = false;

    // Prefer backend path for direct enquiry so vendor notification always triggers server-side.
    if (payload.vendor_id) {
      try {
        const directLeadRes = await fetchWithCsrf(apiUrl(`/api/vendors/${payload.vendor_id}/leads`), {
          method: 'POST',
          body: JSON.stringify(requestPayload),
        });
        const directLeadJson = await directLeadRes.json().catch(() => ({}));
        if (!directLeadRes.ok || !directLeadJson?.success) {
          throw new Error(directLeadJson?.error || 'Failed to create direct enquiry lead');
        }
        leadData = directLeadJson?.lead || null;
        createdThroughVendorLeadApi = true;
      } catch (directLeadError) {
        console.warn('[buyerApi.createProposal] direct lead API failed, falling back:', directLeadError?.message || directLeadError);
      }
    }

    if (!leadData) {
      try {
        leadData = await insertLeadSafely(leadPayload);
        console.log('Lead created successfully:', leadData);
      } catch (leadError) {
        console.error('Failed to create lead record:', leadError, 'Payload:', leadPayload);
        throw new Error(`Proposal created but failed to register as lead: ${leadError.message || 'Unknown error'}`);
      }
    }

    // Fallback client-side notification only when backend lead API wasn't used.
    if (payload.vendor_id && !createdThroughVendorLeadApi) {
      try {
        const { data: vendorProfile } = await supabase
          .from('vendors')
          .select('user_id, email')
          .eq('id', payload.vendor_id)
          .maybeSingle();

        let vendorUserId = vendorProfile?.user_id || null;
        if (!vendorUserId && vendorProfile?.email) {
          const { data: userRow } = await supabase
            .from('users')
            .select('id')
            .eq('email', String(vendorProfile.email).toLowerCase().trim())
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          vendorUserId = userRow?.id || null;
        }

        if (vendorUserId) {
          const notificationPayload = {
            user_id: vendorUserId,
            type: 'NEW_LEAD',
            title: 'New enquiry received',
            message: `${buyerName || 'A buyer'} sent an enquiry for ${payload.product_name || 'your listing'}`,
            link: '/vendor/leads?tab=my_leads',
            reference_id: leadData?.id || proposal?.id || null,
            is_read: false,
            created_at: createdAt,
          };

          let { error: notifError } = await supabase
            .from('notifications')
            .insert([notificationPayload]);

          if (notifError && String(notifError?.message || '').toLowerCase().includes('reference_id')) {
            const fallbackPayload = { ...notificationPayload };
            delete fallbackPayload.reference_id;
            ({ error: notifError } = await supabase.from('notifications').insert([fallbackPayload]));
          }

          if (notifError) throw notifError;
        }
      } catch (notifErr) {
        console.warn('Vendor lead notification failed:', notifErr);
      }
    }

    return proposal;
  },

  getProposals: async (buyerId) => {
    let user = null;
    try {
      user = await getAuthUser();
    } catch {
      user = null;
    }

    if (!buyerId) {
      try {
        buyerId = await getBuyerId();
      } catch {
        buyerId = null;
      }
    }

    const email = String(user?.email || '').toLowerCase().trim();
    const merged = [];
    const seen = new Set();

    const pushRows = (rows = []) => {
      (rows || []).forEach((row) => {
        const key = String(row?.id || '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push(row);
      });
    };

    const fetchSupabaseRows = async (column, value) => {
      if (!value) return;
      try {
        let { data, error } = await supabase
          .from('proposals')
          .select('*, vendors(user_id, company_name, owner_name, profile_image, email, phone, is_verified, verification_badge, kyc_status, is_active)')
          .eq(column, value)
          .order('created_at', { ascending: false });

        if (error) {
          const fallback = await supabase
            .from('proposals')
            .select('*')
            .eq(column, value)
            .order('created_at', { ascending: false });
          data = fallback.data;
          error = fallback.error;
        }

        if (error) {
          console.warn(`[buyerApi.getProposals] ${column} query failed:`, error?.message || error);
          return;
        }
        pushRows(data || []);
      } catch (err) {
        console.warn(`[buyerApi.getProposals] ${column} query threw:`, err?.message || err);
      }
    };

    await fetchSupabaseRows('buyer_id', buyerId);
    await fetchSupabaseRows('buyer_email', email);

    // Backend merge for received quotations (bypasses restrictive RLS on proposals table).
    try {
      const response = await fetchWithCsrf(apiUrl('/api/quotation/received'));
      const json = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(json?.quotations)) {
        const backendRows = json.quotations.map((row) => ({
          ...row,
          vendors: row?.vendors || row?.vendor || null,
        }));
        pushRows(backendRows);
      }
    } catch (err) {
      console.warn('[buyerApi.getProposals] backend quotation merge failed:', err?.message || err);
    }

    // Best effort vendor enrichment for plain rows.
    const missingVendorIds = Array.from(
      new Set(
        merged
          .filter((row) => !row?.vendors)
          .map((row) => String(row?.vendor_id || '').trim())
          .filter(Boolean)
      )
    );

    if (missingVendorIds.length) {
      const { data: vendors, error: vendorErr } = await supabase
        .from('vendors')
        .select('id, user_id, company_name, owner_name, profile_image, email, phone, is_verified, verification_badge, kyc_status, is_active')
        .in('id', missingVendorIds);

      if (!vendorErr && Array.isArray(vendors)) {
        const vendorMap = new Map(vendors.map((v) => [String(v.id), v]));
        for (const row of merged) {
          if (!row?.vendors && row?.vendor_id) {
            row.vendors = vendorMap.get(String(row.vendor_id)) || null;
          }
        }
      }
    }

    return merged.sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());
  },

  // ✅ NEW: Buyer ke sent leads (direct/marketplace) fetch
  // First tries by buyer_id, then fallback by buyer_email
  getSentLeads: async (buyerId) => {
    let user = null;
    try {
      user = await getAuthUser();
    } catch {
      user = null;
    }

    if (!buyerId) {
      try {
        buyerId = await getBuyerId();
      } catch {
        buyerId = null;
      }
    }

    const email = String(user?.email || '').toLowerCase().trim();
    const merged = [];
    const seen = new Set();

    const pushRows = (rows = []) => {
      (rows || []).forEach((row) => {
        const key = String(row?.id || '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push(row);
      });
    };

    if (buyerId) {
      try {
        let { data, error } = await supabase
          .from('leads')
          .select('*, vendors(user_id, company_name, profile_image)')
          .eq('buyer_id', buyerId)
          .order('created_at', { ascending: false });

        if (error) {
          const fallback = await supabase
            .from('leads')
            .select('*')
            .eq('buyer_id', buyerId)
            .order('created_at', { ascending: false });
          data = fallback.data;
          error = fallback.error;
        }

        if (!error) pushRows(data || []);
      } catch {
        // ignore
      }
    }

    if (email) {
      try {
        let { data, error } = await supabase
          .from('leads')
          .select('*, vendors(user_id, company_name, profile_image)')
          .eq('buyer_email', email)
          .order('created_at', { ascending: false });

        if (error) {
          const fallback = await supabase
            .from('leads')
            .select('*')
            .eq('buyer_email', email)
            .order('created_at', { ascending: false });
          data = fallback.data;
          error = fallback.error;
        }

        if (!error) pushRows(data || []);
      } catch {
        // ignore
      }
    }

    return merged.sort(
      (a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime()
    );
  },

  getProposalDetail: async (proposalId) => {
    // Prefer backend detail endpoint (works with cookie auth and legacy buyer mapping).
    try {
      const res = await fetchWithCsrf(apiUrl(`/api/quotation/received/${proposalId}`));
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.quotation) {
        return {
          ...json.quotation,
          messages: json?.quotation?.messages || [],
        };
      }
    } catch (e) {
      console.warn('[buyerApi.getProposalDetail] backend fetch failed, falling back:', e?.message || e);
    }

    let user = null;
    try {
      user = await getAuthUser();
    } catch {
      user = null;
    }

    let proposal = null;
    let propError = null;

    const withVendorRes = await supabase
      .from('proposals')
      .select('*, vendors(user_id, company_name, profile_image, phone, email)')
      .eq('id', proposalId)
      .maybeSingle();

    proposal = withVendorRes.data;
    propError = withVendorRes.error;

    if (propError) {
      const fallbackRes = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .maybeSingle();
      proposal = fallbackRes.data;
      propError = fallbackRes.error;
    }

    if (propError) throw propError;
    if (!proposal) throw new Error('Proposal not found');

    // Buyer guard: allow only own proposal (buyer_id OR buyer_email).
    const buyerId = await resolveBuyerId({ required: false }).catch(() => null);
    const email = String(user?.email || '').toLowerCase().trim();
    if (buyerId || email) {
      const ownerMatch =
        (buyerId && String(proposal?.buyer_id || '') === String(buyerId)) ||
        (email && String(proposal?.buyer_email || '').toLowerCase().trim() === email);
      if (!ownerMatch) {
        throw new Error('Proposal not found');
      }
    }

    if (!proposal?.vendors && proposal?.vendor_id) {
      const { data: vendorRow } = await supabase
        .from('vendors')
        .select('company_name, profile_image, phone, email')
        .eq('id', proposal.vendor_id)
        .maybeSingle();
      if (vendorRow) {
        proposal.vendors = vendorRow;
      }
    }

    const { data: messages, error: msgError } = await supabase
      .from('proposal_messages')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    return {
      ...proposal,
      messages: (messages || []).map((row) => normalizeProposalMessage(row))
    };
  },

  addProposalMessage: async (proposalId, message) => {
    const user = await getAuthUser();

    const { data, error } = await supabase
      .from('proposal_messages')
      .insert([{
        proposal_id: proposalId,
        sender_id: user.id,
        message: message,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateProposalStatus: async (proposalId, status) => {
    const { data, error } = await supabase
      .from('proposals')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', proposalId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- SUPPORT TICKETS ---
  createTicket: async (ticketData) => {
    const buyerId = await getBuyerId();

    const payload = {
      buyer_id: buyerId,
      subject: ticketData.subject,
      description: ticketData.description,
      priority: String(ticketData.priority || 'MEDIUM').toUpperCase(),
      status: 'OPEN',
      category: ticketData.category || 'General Inquiry',
      created_at: new Date().toISOString()
    };
    const res = await fetchWithCsrf(apiUrl('/api/support/tickets'), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to create ticket');
    return json?.ticket || null;
  },

  getTickets: async (buyerId) => {
    if (!buyerId) {
      buyerId = await getBuyerId();
    }
    const res = await fetchWithCsrf(apiUrl('/api/support/tickets'));
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to fetch tickets');
    const rows = Array.isArray(json?.tickets) ? json.tickets : [];
    return rows
      .filter((t) => t?.buyer_id === buyerId)
      .sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
  },

  getTicketDetail: async (ticketId) => {
    const [ticketRes, messagesRes] = await Promise.all([
      fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}`)),
      fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`)),
    ]);

    const ticketJson = await ticketRes.json().catch(() => ({}));
    const msgJson = await messagesRes.json().catch(() => ({}));

    if (!ticketRes.ok) throw new Error(ticketJson?.error || 'Failed to fetch ticket');
    if (!messagesRes.ok) throw new Error(msgJson?.error || 'Failed to fetch ticket messages');

    return {
      ...(ticketJson?.ticket || {}),
      messages: Array.isArray(msgJson?.messages) ? msgJson.messages : [],
    };
  },

  updateTicketStatus: async (ticketId, status) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/status`), {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to update ticket status');
    return json?.ticket || null;
  },

  addTicketMessage: async (ticketId, message) => {
    const user = await getAuthUser();
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`), {
      method: 'POST',
      body: JSON.stringify({
        message,
        sender_id: user.id,
        sender_type: 'BUYER',
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to send ticket message');
    return json?.message || null;
  },

  getTicketMessages: async (ticketId) => {
    const res = await fetchWithCsrf(apiUrl(`/api/support/tickets/${ticketId}/messages`));
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to fetch ticket messages');
    return Array.isArray(json?.messages) ? json.messages : [];
  },

  closeTicket: async (ticketId) => {
    return buyerApi.updateTicketStatus(ticketId, 'CLOSED');
  },

  // --- FAVORITES ---
  addFavorite: async (vendorId) => {
    const buyerId = await getBuyerId();

    const { data, error } = await supabase
      .from('favorites')
      .insert([{
        buyer_id: buyerId,
        vendor_id: vendorId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  removeFavorite: async (vendorId) => {
    const buyerId = await getBuyerId();

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('buyer_id', buyerId)
      .eq('vendor_id', vendorId);

    if (error) throw error;
  },

  getFavorites: async (buyerId) => {
    if (!buyerId) {
      buyerId = await getBuyerId();
    }

    const { data, error } = await supabase
      .from('favorites')
      .select('*, vendors(id, user_id, company_name, email, phone, profile_image, verification_badge, seller_rating)')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  isFavorited: async (vendorId) => {
    const buyerId = await getBuyerId();

    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },

  // --- SUGGESTIONS ---
  getSuggestions: async () => {
    const buyerId = await getBuyerId();

    const { data, error } = await supabase
      .from('suggestions')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  createSuggestion: async (suggestionData) => {
    const buyerId = await getBuyerId();

    const { data, error } = await supabase
      .from('suggestions')
      .insert([{
        buyer_id: buyerId,
        subject: suggestionData.subject,
        message: suggestionData.message,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- DIRECTORY ---
  searchProposalVendors: async (searchTerm) => {
    const term = String(searchTerm || '').trim().replace(/[,%'()]/g, ' ');
    if (term.length < 2) return [];

    let query = supabase
      .from('vendors')
      .select('id, vendor_id, company_name, owner_name, email, phone, city, state, pincode, state_id, city_id, kyc_status, is_active, is_verified')
      .eq('is_active', true)
      .or(
        `company_name.ilike.%${term}%,owner_name.ilike.%${term}%,vendor_id.ilike.%${term}%,email.ilike.%${term}%`
      );

    const { data, error } = await query
      .order('is_verified', { ascending: false })
      .order('company_name', { ascending: true })
      .limit(10);

    if (error) throw error;
    return data || [];
  },

  getProposalTargetVendor: async (vendorRef) => {
    const normalized = String(vendorRef || '').trim();
    if (!normalized) return null;

    const selectFields =
      'id, vendor_id, company_name, owner_name, email, phone, city, state, pincode, state_id, city_id, kyc_status, is_active, is_verified';

    if (normalized.includes('@')) {
      const { data, error } = await supabase
        .from('vendors')
        .select(selectFields)
        .eq('email', normalized.toLowerCase())
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data || null;
    }

    const { data: byVendorId, error: byVendorIdError } = await supabase
      .from('vendors')
      .select(selectFields)
      .eq('vendor_id', normalized)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byVendorIdError) throw byVendorIdError;
    if (byVendorId) return byVendorId;

    if (!isUuid(normalized)) return null;

    const { data: byId, error: byIdError } = await supabase
      .from('vendors')
      .select(selectFields)
      .eq('id', normalized)
      .eq('is_active', true)
      .maybeSingle();

    if (byIdError) throw byIdError;
    return byId || null;
  },

  searchVendors: async (filters = {}) => {
    let query = supabase
      .from('vendors')
      .select('id, company_name, email, phone, profile_image, verification_badge, seller_rating, state, city');

    if (filters.state_id) {
      query = query.eq('state_id', filters.state_id);
    }
    if (filters.city_id) {
      query = query.eq('city_id', filters.city_id);
    }
    if (filters.search) {
      query = query.ilike('company_name', `%${filters.search}%`);
    }

    query = query.eq('is_active', true).eq('is_verified', true);

    const { data, error } = await query
      .order('seller_rating', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  },

  getVendorProfile: async (vendorId) => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (error) throw error;
    return data;
  },

  getVendorProducts: async (vendorId) => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};
