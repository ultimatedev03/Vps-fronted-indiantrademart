import { Suspense, lazy, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const AIChatWidget = lazy(() => import('@/components/AIChatWidget'));

const INTERNAL_PATH_PREFIXES = [
  '/admin',
  '/employee',
  '/finance-portal',
  '/hr',
  '/vendor',
  '/buyer',
  '/management',
  '/migration-tools',
];

const DeferredAIChatWidget = () => {
  const location = useLocation();
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const pathname = String(location.pathname || '');
    const isInternalRoute = INTERNAL_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

    if (isInternalRoute) {
      setShouldMount(false);
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;
    let idleId = null;

    const enableMount = () => {
      if (!cancelled) setShouldMount(true);
    };

    const scheduleIdleMount = () => {
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(enableMount, { timeout: 5000 });
        return;
      }
      timeoutId = window.setTimeout(enableMount, 4000);
    };

    const cleanupListeners = () => {
      if (typeof window === 'undefined') return;
      window.removeEventListener('pointerdown', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
      window.removeEventListener('touchstart', onFirstInteraction);
    };

    const onFirstInteraction = () => {
      cleanupListeners();
      scheduleIdleMount();
    };

    window.addEventListener('pointerdown', onFirstInteraction, { once: true, passive: true });
    window.addEventListener('keydown', onFirstInteraction, { once: true });
    window.addEventListener('touchstart', onFirstInteraction, { once: true, passive: true });
    timeoutId = window.setTimeout(onFirstInteraction, 6000);

    return () => {
      cancelled = true;
      cleanupListeners();
      if (idleId && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [location.pathname]);

  if (!shouldMount) return null;

  return (
    <Suspense fallback={null}>
      <AIChatWidget />
    </Suspense>
  );
};

export default DeferredAIChatWidget;
