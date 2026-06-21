const MODAL_EVENT = 'itm:modal-state-change';
const ACTIVE_COUNT_KEY = '__ITM_ACTIVE_MODAL_COUNT__';
const QUOTE_SUPPRESS_UNTIL_KEY = 'itm_quote_popup_suppress_until';

const getWindow = () => (typeof window === 'undefined' ? null : window);

const getActiveCount = () => {
  const win = getWindow();
  return Math.max(0, Number(win?.[ACTIVE_COUNT_KEY] || 0));
};

const setActiveCount = (count) => {
  const win = getWindow();
  if (!win) return;
  win[ACTIVE_COUNT_KEY] = Math.max(0, Number(count || 0));
  win.dispatchEvent(new CustomEvent(MODAL_EVENT, { detail: { activeCount: win[ACTIVE_COUNT_KEY] } }));
};

export const setGlobalModalOpen = (open) => {
  const current = getActiveCount();
  setActiveCount(open ? current + 1 : current - 1);
};

export const suppressQuotePopup = (ms = 90_000) => {
  const win = getWindow();
  if (!win) return;
  try {
    const until = Date.now() + Math.max(0, Number(ms || 0));
    win.sessionStorage.setItem(QUOTE_SUPPRESS_UNTIL_KEY, String(until));
    win.dispatchEvent(new CustomEvent(MODAL_EVENT, { detail: { suppressUntil: until } }));
  } catch {
    // ignore storage errors
  }
};

export const isQuotePopupSuppressed = () => {
  const win = getWindow();
  if (!win) return false;
  try {
    const until = Number(win.sessionStorage.getItem(QUOTE_SUPPRESS_UNTIL_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
};

export const isBlockingPopupOpen = () => {
  const win = getWindow();
  if (!win) return false;
  if (getActiveCount() > 0) return true;

  const doc = win.document;
  if (!doc) return false;

  const openDialog = doc.querySelector('[role="dialog"], [data-radix-dialog-content], [data-state="open"][aria-modal="true"]');
  if (openDialog) return true;

  return doc.body?.style?.overflow === 'hidden';
};

export const onPopupStateChange = (listener) => {
  const win = getWindow();
  if (!win) return () => {};
  win.addEventListener(MODAL_EVENT, listener);
  return () => win.removeEventListener(MODAL_EVENT, listener);
};
