import { Suspense, lazy, useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '@/shared/components/Header';
import { useDeferredMount } from '@/shared/hooks/useDeferredMount';

const Footer = lazy(() => import('@/shared/components/Footer'));
const QuotePopup = lazy(() => import('@/shared/components/QuotePopup'));

const FOOTER_SUPPRESSED_ROUTES = [
  /^\/directory\/vendor\/[^/?#]+\/?$/i,
  /^\/product\/[^/?#]+\/?$/i,
  /^\/directory\/search\/.+/i,
];

const shouldSuppressFooter = (pathname = '') =>
  FOOTER_SUPPRESSED_ROUTES.some((routePattern) => routePattern.test(pathname));

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
  const footerReady = useDeferredMount({ delay: 6500, idleTimeout: 9000 });
  const quotePopupReady = useDeferredMount({ delay: 9000, idleTimeout: 12000 });
  const suppressFooter = shouldSuppressFooter(location.pathname);

  useLayoutEffect(() => {
    if (!suppressFooter || typeof window === 'undefined') return undefined;

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
  }, [location.pathname, suppressFooter]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-grow pt-16" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        <Suspense fallback={<OutletFallback />}>
          <Outlet />
        </Suspense>
      </main>

      {footerReady && !suppressFooter && (
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
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
