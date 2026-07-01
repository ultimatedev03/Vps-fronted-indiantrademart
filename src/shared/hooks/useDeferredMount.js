import { useEffect, useState } from 'react';

export const useDeferredMount = ({ delay = 1200, idleTimeout = 3500, afterLoad = true } = {}) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setReady(true);
      return undefined;
    }

    let delayId = null;
    let idleId = null;
    let loadFallbackId = null;
    let cancelled = false;

    const enable = () => {
      if (!cancelled) setReady(true);
    };

    const scheduleIdle = () => {
      delayId = window.setTimeout(() => {
        if (typeof window.requestIdleCallback === 'function') {
          idleId = window.requestIdleCallback(enable, { timeout: idleTimeout });
          return;
        }
        enable();
      }, delay);
    };

    if (afterLoad && document.readyState !== 'complete') {
      const onLoad = () => {
        window.removeEventListener('load', onLoad);
        if (loadFallbackId) {
          window.clearTimeout(loadFallbackId);
          loadFallbackId = null;
        }
        scheduleIdle();
      };

      window.addEventListener('load', onLoad, { once: true });
      loadFallbackId = window.setTimeout(onLoad, Math.max(1800, delay + 500));

      return () => {
        cancelled = true;
        window.removeEventListener('load', onLoad);
        if (delayId) window.clearTimeout(delayId);
        if (loadFallbackId) window.clearTimeout(loadFallbackId);
        if (idleId && typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    scheduleIdle();

    return () => {
      cancelled = true;
      if (delayId) window.clearTimeout(delayId);
      if (loadFallbackId) window.clearTimeout(loadFallbackId);
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [afterLoad, delay, idleTimeout]);

  return ready;
};
