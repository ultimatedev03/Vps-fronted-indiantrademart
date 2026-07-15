import { Suspense, lazy, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '@/shared/components/Header';
import { useDeferredMount } from '@/shared/hooks/useDeferredMount';

const Footer = lazy(() => import('@/shared/components/Footer'));
const QuotePopup = lazy(() => import('@/shared/components/QuotePopup'));

const FOOTER_PRIORITY_ROUTES = [
  /^\/directory\/vendor\/[^/?#]+\/?$/i,
  /^\/product\/[^/?#]+\/?$/i,
  /^\/directory\/search\/.+/i,
];

const shouldPrioritizeFooter = (pathname = '') =>
  FOOTER_PRIORITY_ROUTES.some((routePattern) => routePattern.test(pathname));

const OutletFallback = () => (
  <div className="bg-slate-50 px-4 py-8" style={{ minHeight: 'calc(100vh - 8rem)' }}>
    <div className="mx-auto w-[92vw] max-w-[1760px] space-y-6">
      <div className="h-32 rounded-xl border border-slate-200 bg-white shadow-sm" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="h-10 w-80 max-w-full rounded-lg bg-white shadow-sm" />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <div className="h-56 rounded-xl border border-slate-200 bg-white shadow-sm" />
            <div className="h-56 rounded-xl border border-slate-200 bg-white shadow-sm" />
            <div className="h-56 rounded-xl border border-slate-200 bg-white shadow-sm" />
          </div>
        </div>
        <div className="h-56 rounded-xl border border-slate-200 bg-white shadow-sm" />
      </div>
    </div>
  </div>
);

const PublicLayout = () => {
  const location = useLocation();
  const footerSlotRef = useRef(null);
  const footerReady = useDeferredMount({ delay: 6500, idleTimeout: 9000 });
  const quotePopupReady = useDeferredMount({ delay: 9000, idleTimeout: 12000 });
  const prioritizeFooter = shouldPrioritizeFooter(location.pathname);
  const showFooter = footerReady || prioritizeFooter;
  const shellClassName = prioritizeFooter
    ? 'itm-public-canvas flex flex-col'
    : 'itm-public-canvas min-h-screen flex flex-col';
  const mainClassName = prioritizeFooter
    ? 'itm-cinematic-enter pt-[76px]'
    : 'itm-cinematic-enter flex-grow pt-[76px]';
  const mainStyle = prioritizeFooter ? undefined : { minHeight: 'calc(100vh - 76px)' };

  useLayoutEffect(() => {
    if (!prioritizeFooter || typeof window === 'undefined') return undefined;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    resetScroll();

    const frameId = window.requestAnimationFrame(resetScroll);
    const timerIds = [75, 250, 900].map((delay) => window.setTimeout(resetScroll, delay));

    return () => {
      window.cancelAnimationFrame(frameId);
      timerIds.forEach((timerId) => window.clearTimeout(timerId));
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [location.pathname, prioritizeFooter]);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;

    if (!prioritizeFooter) {
      delete document.documentElement.dataset.itmDetailRoute;
      return undefined;
    }

    document.documentElement.dataset.itmDetailRoute = 'true';

    return () => {
      delete document.documentElement.dataset.itmDetailRoute;
    };
  }, [prioritizeFooter]);

  useLayoutEffect(() => {
    if (!prioritizeFooter || typeof window === 'undefined') return undefined;

    let rafId = 0;
    const timers = [];

    const clampAfterFooter = () => {
      const footerSlot = footerSlotRef.current;
      if (!footerSlot) return;

      const footerBottom = footerSlot.getBoundingClientRect().bottom + window.scrollY;
      const maxScrollTop = Math.max(0, Math.ceil(footerBottom - window.innerHeight));

      if (window.scrollY > maxScrollTop + 2) {
        window.scrollTo({ top: maxScrollTop, left: 0, behavior: 'auto' });
      }
    };

    const scheduleClamp = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(clampAfterFooter);
    };

    scheduleClamp();
    [150, 500, 1200].forEach((delay) => {
      timers.push(window.setTimeout(scheduleClamp, delay));
    });

    window.addEventListener('scroll', scheduleClamp, { passive: true });
    window.addEventListener('resize', scheduleClamp);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      timers.forEach((timerId) => window.clearTimeout(timerId));
      window.removeEventListener('scroll', scheduleClamp);
      window.removeEventListener('resize', scheduleClamp);
    };
  }, [location.pathname, prioritizeFooter, showFooter]);

  return (
    <div className={shellClassName}>
      <Header />

      <main className={mainClassName} style={mainStyle}>
        <Suspense fallback={<OutletFallback />}>
          <Outlet />
        </Suspense>
      </main>

      {showFooter && (
        <div ref={footerSlotRef} data-itm-site-footer="">
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        </div>
      )}

      {quotePopupReady && (
        <Suspense fallback={null}>
          <QuotePopup />
        </Suspense>
      )}
    </div>
  );
};

export default PublicLayout;
