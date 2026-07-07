import { Suspense, lazy } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/shared/components/Header';
import { useDeferredMount } from '@/shared/hooks/useDeferredMount';

const Footer = lazy(() => import('@/shared/components/Footer'));
const QuotePopup = lazy(() => import('@/shared/components/QuotePopup'));

const OutletFallback = () => (
  <div className="min-h-[calc(100vh-8rem)] bg-slate-50" />
);

const PublicLayout = () => {
  const footerReady = useDeferredMount({ delay: 6500, idleTimeout: 9000 });
  const quotePopupReady = useDeferredMount({ delay: 9000, idleTimeout: 12000 });

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="min-h-[calc(100vh-4rem)] flex-grow pt-16">
        <Suspense fallback={<OutletFallback />}>
          <Outlet />
        </Suspense>
      </main>

      {footerReady && (
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
