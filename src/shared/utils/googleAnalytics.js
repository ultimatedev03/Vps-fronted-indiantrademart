const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const PARAM_NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const BLOCKED_PARAM_PATTERN = /(^|_)(email|phone|mobile|contact_name|buyer_name|visitor_name|message|description)(_|$)/i;
const MAX_PARAM_LENGTH = 100;

const cleanText = (value, maxLength = MAX_PARAM_LENGTH) => {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, maxLength) : '';
};

const cleanItem = (item = {}) => {
  const allowedKeys = new Set([
    'item_id',
    'item_name',
    'item_brand',
    'item_category',
    'item_category2',
    'item_category3',
    'item_list_id',
    'item_list_name',
    'item_variant',
    'index',
    'price',
    'quantity',
  ]);

  return Object.fromEntries(
    Object.entries(item)
      .filter(([key, value]) => allowedKeys.has(key) && value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, typeof value === 'string' ? cleanText(value) : value])
  );
};

const inferUserRole = () => {
  if (typeof window === 'undefined') return 'public';
  const path = String(window.location.pathname || '').toLowerCase();
  if (path === '/buyer' || path.startsWith('/buyer/')) return 'buyer';
  if (path === '/vendor' || path.startsWith('/vendor/')) return 'vendor';
  if (path.startsWith('/admin/') || path.startsWith('/superadmin/')) return 'admin';
  if (path.startsWith('/employee/') || path.startsWith('/hr/') || path.startsWith('/finance-portal/')) {
    return 'staff';
  }
  return 'public';
};

const sanitizeParams = (params = {}) => {
  const sanitized = {};

  Object.entries(params).forEach(([key, value]) => {
    if (!PARAM_NAME_PATTERN.test(key) || BLOCKED_PARAM_PATTERN.test(key)) return;
    if (value === undefined || value === null || value === '') return;

    if (key === 'items' && Array.isArray(value)) {
      const items = value.map(cleanItem).filter((item) => Object.keys(item).length > 0).slice(0, 20);
      if (items.length) sanitized.items = items;
      return;
    }

    if (typeof value === 'string') {
      const cleaned = cleanText(value);
      if (cleaned) sanitized[key] = cleaned;
      return;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      sanitized[key] = value;
      return;
    }

    if (typeof value === 'boolean') sanitized[key] = value;
  });

  if (!sanitized.itm_user_role) sanitized.itm_user_role = inferUserRole();
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ga_debug') === '1') {
    sanitized.debug_mode = true;
  }

  return sanitized;
};

export const trackGoogleAnalyticsEvent = (eventName, params = {}) => {
  if (!import.meta.env.PROD || typeof window === 'undefined') return false;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return false;

  const normalizedName = cleanText(eventName, 40).toLowerCase();
  if (!EVENT_NAME_PATTERN.test(normalizedName) || typeof window.gtag !== 'function') return false;

  window.gtag('event', normalizedName, sanitizeParams(params));
  return true;
};

export const trackVisitorAnalyticsEvent = (eventType, payload = {}) => {
  const normalizedType = String(eventType || '').trim().toUpperCase();
  const role = cleanText(payload?.metadata?.user_role || payload?.user_role || 'public', 40).toLowerCase();
  const common = { itm_user_role: role || 'public' };

  if (normalizedType === 'SEARCH') {
    return trackGoogleAnalyticsEvent('search', {
      ...common,
      search_term: payload.search_query,
      itm_location: payload.city || payload.state || payload.location,
    });
  }

  if (normalizedType === 'PRODUCT_VIEW') {
    return trackGoogleAnalyticsEvent('view_item', {
      ...common,
      itm_product_id: payload.entity_id,
      items: [
        {
          item_id: payload.entity_id,
          item_name: payload.entity_name,
          item_category: payload.category,
        },
      ],
    });
  }

  if (normalizedType === 'VENDOR_VIEW') {
    return trackGoogleAnalyticsEvent('view_vendor', {
      ...common,
      itm_vendor_id: payload.entity_id,
    });
  }

  if (normalizedType === 'CITY_VIEW') {
    return trackGoogleAnalyticsEvent('view_location', {
      ...common,
      itm_location: payload.city || payload.entity_name,
    });
  }

  if (normalizedType === 'CATEGORY_VIEW') {
    return trackGoogleAnalyticsEvent('view_category', {
      ...common,
      item_list_id: payload.entity_id,
      item_list_name: payload.entity_name,
    });
  }

  if (normalizedType === 'PLAN_VIEW') {
    return trackGoogleAnalyticsEvent('view_pricing', common);
  }

  return false;
};
