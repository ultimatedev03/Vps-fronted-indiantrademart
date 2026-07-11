import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSubdomain } from '@/contexts/SubdomainContext';
import { useAuth } from '@/contexts/AppAuthContext';
import { identifyVisitorContact, trackVisitorEvent } from '@/shared/utils/visitorTracking';

const INTERNAL_PATH_PREFIXES = [
  '/admin',
  '/api',
  '/buyer',
  '/employee',
  '/finance-portal',
  '/hr',
  '/management',
  '/migration-tools',
  '/superadmin',
  '/vendor',
];

const INTERNAL_APP_TYPES = new Set(['admin', 'buyer', 'employee', 'management', 'vendor']);

const titleFromSlug = (value = '') =>
  String(value || '')
    .replace(/\?.*$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getPathSegments = (path = '') =>
  String(path || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

const isInternalPath = (path = '') => {
  const normalized = String(path || '').trim().toLowerCase();
  return INTERNAL_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
};

const isPublicTrackingRoute = (appType = '', path = '') => {
  const normalizedAppType = String(appType || '').trim().toLowerCase();
  if (INTERNAL_APP_TYPES.has(normalizedAppType)) return false;
  return !isInternalPath(path);
};

const getSearchQueryFromRoute = (path = '', search = '') => {
  const params = new URLSearchParams(search || '');
  const queryKeys = ['q', 'query', 'search', 'term', 'keyword', 'product', 'service'];
  for (const key of queryKeys) {
    const value = params.get(key);
    if (String(value || '').trim()) return String(value).trim();
  }

  const segments = getPathSegments(path);
  if (segments[0] === 'directory' && segments[1] === 'search' && segments[2]) {
    return titleFromSlug(segments[2]);
  }

  return '';
};

const inferRouteEvent = (path = '') => {
  const segments = getPathSegments(path);
  if (!segments.length) return null;

  if (segments[0] === 'product' && segments[1]) {
    return {
      eventType: 'PRODUCT_VIEW',
      entity_type: 'PRODUCT',
      entity_id: segments[1],
      entity_name: titleFromSlug(segments[1]),
    };
  }

  if (segments[0] === 'directory' && segments[1] === 'vendor' && segments[2]) {
    return {
      eventType: 'VENDOR_VIEW',
      entity_type: 'VENDOR',
      entity_id: segments[2],
      entity_name: titleFromSlug(segments[2]),
    };
  }

  if ((segments[0] === 'directory' && segments[1] === 'city' && segments[2]) || (segments[0] === 'city' && segments[1])) {
    const citySlug = segments[0] === 'city' ? segments[1] : segments[2];
    return {
      eventType: 'CITY_VIEW',
      entity_type: 'CITY',
      entity_id: citySlug,
      entity_name: titleFromSlug(citySlug),
      city: titleFromSlug(citySlug),
    };
  }

  if (segments[0] === 'directory' && segments[1] && !['search', 'vendor', 'city', 'cities', 'brand'].includes(segments[1])) {
    const categorySlug = segments[segments.length - 1];
    return {
      eventType: 'CATEGORY_VIEW',
      entity_type: 'CATEGORY',
      entity_id: segments.slice(1).join('/'),
      entity_name: titleFromSlug(categorySlug),
      category: titleFromSlug(categorySlug),
    };
  }

  if (segments[0] === 'pricing') {
    return {
      eventType: 'PLAN_VIEW',
      entity_type: 'PLAN_PAGE',
      entity_id: 'pricing',
      entity_name: 'Pricing',
    };
  }

  return null;
};

const buildBasePayload = (location, appType = '', userRole = '') => ({
  page_path: location.pathname || '/',
  page_url: typeof window !== 'undefined' ? window.location.href : '',
  page_title: typeof document !== 'undefined' ? document.title || '' : '',
  metadata: {
    app_type: appType || 'public',
    user_role: String(userRole || 'public').trim().toLowerCase(),
    hash: location.hash || '',
    viewport:
      typeof window !== 'undefined'
        ? `${window.innerWidth || 0}x${window.innerHeight || 0}`
        : '',
  },
});

const VisitorActivityTracker = () => {
  const location = useLocation();
  const { appType } = useSubdomain();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!isPublicTrackingRoute(appType, location.pathname)) return;
    if (!user?.email && !profile?.email && !profile?.phone && !profile?.company_name) return;

    identifyVisitorContact({
      name: profile?.full_name || profile?.owner_name || profile?.contact_name || user?.name || user?.email,
      email: profile?.email || user?.email,
      phone: profile?.phone || profile?.mobile_number || profile?.whatsapp,
      company: profile?.company_name || profile?.business_name,
      source: user?.role ? `${String(user.role).toUpperCase()}_SESSION` : 'PUBLIC_SESSION',
    });
  }, [appType, location.pathname, profile, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!isPublicTrackingRoute(appType, location.pathname)) return undefined;

    const timer = window.setTimeout(() => {
      const basePayload = buildBasePayload(location, appType, user?.role);
      trackVisitorEvent('PAGE_VIEW', basePayload, { dedupeMs: 90 * 1000 });

      const searchQuery = getSearchQueryFromRoute(location.pathname, location.search);
      if (searchQuery) {
        trackVisitorEvent(
          'SEARCH',
          {
            ...basePayload,
            search_query: searchQuery,
            entity_type: 'SEARCH',
            entity_name: searchQuery,
          },
          { dedupeMs: 10 * 60 * 1000 }
        );
      }

      const routeEvent = inferRouteEvent(location.pathname);
      if (routeEvent) {
        trackVisitorEvent(
          routeEvent.eventType,
          {
            ...basePayload,
            ...routeEvent,
          },
          { dedupeMs: 10 * 60 * 1000 }
        );
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [appType, location.hash, location.pathname, location.search, user?.role]);

  return null;
};

export default VisitorActivityTracker;
