import { Suspense, lazy } from 'react';
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
  <div className="bg-slate-50" style={{ minHeight: 'calc(100vh - 8rem)' }} />
);

const PublicLayout = () => {
  const location = useLocation();
  const footerReady = useDeferredMount({ delay: 6500, idleTimeout: 9000 });
  const quotePopupReady = useDeferredMount({ delay: 9000, idleTimeout: 12000 });
  const suppressFooter = shouldSuppressFooter(location.pathname);

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
