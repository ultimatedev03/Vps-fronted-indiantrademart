import { apiUrl } from '@/lib/apiBase';
import { trackVisitorAnalyticsEvent } from '@/shared/utils/googleAnalytics';

const VISITOR_COOKIE = 'itm_visitor_id';
const SESSION_KEY = 'itm_visitor_session_id';
const LANDING_PAGE_KEY = 'itm_visitor_landing_page';
const EVENT_DEDUPE_KEY = 'itm_visitor_event_dedupe';
const CONTACT_KEY = 'itm_visitor_contact';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const DEFAULT_DEDUPE_MS = 4 * 60 * 1000;
const EVENT_BATCH_SIZE = 8;
const EVENT_FLUSH_DELAY_MS = 1500;

let eventBuffer = [];
let eventFlushTimer = null;
let flushListenersBound = false;

const makeId = (prefix) => {
  const randomPart =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 18)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
};

const readCookie = (name) => {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  const row = document.cookie
    .split('; ')
    .find((item) => item.startsWith(prefix));
  return row ? decodeURIComponent(row.slice(prefix.length)) : '';
};

const writeCookie = (name, value) => {
  if (typeof document === 'undefined' || !value) return;
  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ].join('; ');
};

export const getVisitorId = () => {
  const existing = readCookie(VISITOR_COOKIE);
  if (existing) return existing;

  const next = makeId('vis');
  writeCookie(VISITOR_COOKIE, next);
  return next;
};

export const getVisitorSessionId = () => {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const next = makeId('ses');
    window.sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return makeId('ses');
  }
};

const getLandingPage = () => {
  if (typeof window === 'undefined') return '/';
  try {
    const existing = window.sessionStorage.getItem(LANDING_PAGE_KEY);
    if (existing) return existing;

    const next = `${window.location.pathname || '/'}${window.location.search || ''}`;
    window.sessionStorage.setItem(LANDING_PAGE_KEY, next);
    return next;
  } catch {
    return window.location.pathname || '/';
  }
};

const readDedupeMap = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(EVENT_DEDUPE_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

const writeDedupeMap = (map = {}) => {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(map)
      .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))
      .slice(0, 80);
    window.sessionStorage.setItem(EVENT_DEDUPE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Ignore storage errors in locked-down browsers.
  }
};

const buildDedupeKey = (eventType = '', payload = {}) =>
  [
    String(eventType || '').toUpperCase(),
    payload.page_path || (typeof window !== 'undefined' ? window.location.pathname : ''),
    payload.search_query || '',
    payload.entity_type || '',
    payload.entity_id || payload.entity_name || '',
  ].join('|');

const cleanText = (value = '', max = 500) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
};

const normalizeEmail = (value = '') => cleanText(value, 191).toLowerCase();

const normalizePhone = (value = '') => cleanText(value, 64).replace(/[^\d+()\-\s]/g, '').slice(0, 64);

const readVisitorContact = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(CONTACT_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

const writeVisitorContact = (contact = {}) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
  } catch {
    // Ignore storage errors in restricted browsers.
  }
};

export const identifyVisitorContact = (details = {}) => {
  if (typeof window === 'undefined') return {};

  const existing = readVisitorContact();
  const next = {
    ...existing,
    visitor_name: cleanText(details.visitor_name || details.name || details.buyer_name || existing.visitor_name, 500),
    visitor_email: normalizeEmail(details.visitor_email || details.email || details.buyer_email || existing.visitor_email),
    visitor_phone: normalizePhone(details.visitor_phone || details.phone || details.buyer_phone || existing.visitor_phone),
    visitor_company: cleanText(details.visitor_company || details.company || details.company_name || existing.visitor_company, 500),
    visitor_contact_source: cleanText(details.visitor_contact_source || details.source || existing.visitor_contact_source || 'WEBSITE_FORM', 191),
    visitor_contact_updated_at: new Date().toISOString(),
  };

  const hasContact = next.visitor_name || next.visitor_email || next.visitor_phone || next.visitor_company;
  if (!hasContact) return existing;

  writeVisitorContact(next);
  return next;
};

export const getVisitorContactContext = () => {
  const contact = readVisitorContact();
  return {
    visitor_name: cleanText(contact.visitor_name, 500) || undefined,
    visitor_email: normalizeEmail(contact.visitor_email) || undefined,
    visitor_phone: normalizePhone(contact.visitor_phone) || undefined,
    visitor_company: cleanText(contact.visitor_company, 500) || undefined,
    visitor_contact_source: cleanText(contact.visitor_contact_source, 191) || undefined,
  };
};

const shouldSendEvent = (eventType, payload, dedupeMs) => {
  if (!dedupeMs) return true;
  const now = Date.now();
  const key = buildDedupeKey(eventType, payload);
  const map = readDedupeMap();
  const lastSentAt = Number(map[key] || 0);
  if (lastSentAt && now - lastSentAt < dedupeMs) return false;
  map[key] = now;
  writeDedupeMap(map);
  return true;
};

const scheduleEventFlush = () => {
  if (typeof window === 'undefined' || eventFlushTimer) return;
  eventFlushTimer = window.setTimeout(() => {
    eventFlushTimer = null;
    void flushVisitorEvents();
  }, EVENT_FLUSH_DELAY_MS);
};

const bindFlushListeners = () => {
  if (typeof window === 'undefined' || flushListenersBound) return;
  flushListenersBound = true;
  window.addEventListener('pagehide', () => {
    void flushVisitorEvents({ useBeacon: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushVisitorEvents({ useBeacon: true });
    }
  });
};

export const flushVisitorEvents = async ({ useBeacon = false } = {}) => {
  if (typeof window === 'undefined' || !eventBuffer.length) return false;
  if (eventFlushTimer) {
    window.clearTimeout(eventFlushTimer);
    eventFlushTimer = null;
  }

  const batch = eventBuffer.splice(0, EVENT_BATCH_SIZE);
  const body = JSON.stringify({ events: batch });
  const endpoint = apiUrl('/api/visitor/events/batch');

  if (useBeacon && navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) {
        if (eventBuffer.length) scheduleEventFlush();
        return true;
      }
    } catch {
      // Fall through to fetch when beacon transport is unavailable.
    }
  }

  try {
    await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      keepalive: true,
    });
    if (eventBuffer.length) scheduleEventFlush();
    return true;
  } catch {
    if (eventBuffer.length) scheduleEventFlush();
    return false;
  }
};

const enqueueVisitorEvent = (event, immediate = false) => {
  bindFlushListeners();
  eventBuffer.push(event);
  if (eventBuffer.length > 50) eventBuffer = eventBuffer.slice(-50);
  if (immediate || eventBuffer.length >= EVENT_BATCH_SIZE) {
    void flushVisitorEvents();
  } else {
    scheduleEventFlush();
  }
};

export const getVisitorActivityContext = () => {
  if (typeof window === 'undefined') return {};

  return {
    visitor_id: getVisitorId(),
    visitor_session_id: getVisitorSessionId(),
    landing_page: getLandingPage(),
    page_url: window.location.href,
    page_path: window.location.pathname || '/',
    page_title: document.title || '',
    referrer: document.referrer || '',
    user_agent: navigator.userAgent || '',
    ...getVisitorContactContext(),
  };
};

export const trackVisitorEvent = (eventType, payload = {}, options = {}) => {
  if (typeof window === 'undefined') return false;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return false;

  const normalizedType = String(eventType || 'PAGE_VIEW').trim().toUpperCase();
  const eventPayload = {
    ...getVisitorActivityContext(),
    ...(payload || {}),
    event_type: normalizedType,
  };

  const dedupeMs = Number.isFinite(Number(options.dedupeMs))
    ? Math.max(0, Number(options.dedupeMs))
    : DEFAULT_DEDUPE_MS;
  if (!shouldSendEvent(normalizedType, eventPayload, dedupeMs)) return false;

  if (normalizedType !== 'PAGE_VIEW') {
    trackVisitorAnalyticsEvent(normalizedType, eventPayload);
  }

  enqueueVisitorEvent(eventPayload, options.immediate === true || normalizedType === 'REQUIREMENT_SUBMIT');
  return true;
};

export const getVisitorLeadContext = () => {
  if (typeof window === 'undefined') return {};

  return {
    visitor_id: getVisitorId(),
    visitor_session_id: getVisitorSessionId(),
    lead_origin: 'WEBSITE_REQUIREMENT_FORM',
    landing_page: getLandingPage(),
    page_url: window.location.href,
    referrer: document.referrer || '',
    user_agent: navigator.userAgent || '',
    consent_source: 'submitted_requirement_form',
    ...getVisitorContactContext(),
  };
};
