import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { AuthProvider } from '@/contexts/AppAuthContext';
import { InternalAuthProvider } from '@/modules/admin/context/InternalAuthContext';
import { SuperAdminProvider } from '@/modules/admin/context/SuperAdminContext';
import { AuthProvider as VendorAuthProvider } from '@/modules/vendor/context/AuthContext';
import { useAuth as useVendorAuth } from '@/modules/vendor/context/AuthContext';
import { EmployeeAuthProvider } from '@/modules/employee/context/EmployeeAuthContext';
import { SubdomainProvider, useSubdomain } from '@/contexts/SubdomainContext';
import { PageStatusProvider } from '@/contexts/PageStatusContext';
import { locationService } from '@/shared/services/locationService';
import { dbClient } from '@/lib/dbClient';
import { apiUrl } from '@/lib/apiBase';
import { booleanValue } from '@/lib/booleanValue';
import AnalyticsLoader from '@/components/AnalyticsLoader';
import DeferredAIChatWidget from '@/shared/components/DeferredAIChatWidget';
import ScrollToTopButton from '@/shared/components/ScrollToTopButton';
import VisitorActivityTracker from '@/shared/components/VisitorActivityTracker';
import { useDeferredMount } from '@/shared/hooks/useDeferredMount';

const MaintenancePage = lazy(() => import('@/shared/components/MaintenancePage'));

const RouteLoadingFallback = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#003D82]" />
      <p className="mt-3 text-sm font-semibold text-slate-700">Loading page...</p>
    </div>
  </div>
);

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) {
      console.error('[RouteErrorBoundary]', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">Page could not load</h1>
            <p className="mt-2 text-sm text-slate-600">Please refresh once to load the latest version.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-[#003D82] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002f64]"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Optional integrations must never be able to take down the main application shell.
class NonCriticalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) {
      console.error('[NonCriticalErrorBoundary]', error);
    }
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

// Route Modules (lazy)
const VendorRoutes = lazy(() => import('@/modules/vendor/routes').then((m) => ({ default: m.VendorRoutes })));
const BuyerRoutes = lazy(() => import('@/modules/buyer/routes').then((m) => ({ default: m.BuyerRoutes })));
const AdminRoutes = lazy(() => import('@/modules/admin/routes').then((m) => ({ default: m.AdminRoutes })));
const EmployeeRoutes = lazy(() => import('@/modules/employee/routes').then((m) => ({ default: m.EmployeeRoutes })));
const DirectoryRoutes = lazy(() => import('@/modules/directory/routes').then((m) => ({ default: m.DirectoryRoutes })));
const CareerRoutes = lazy(() => import('@/modules/career/routes').then((m) => ({ default: m.CareerRoutes })));

const ManagementPortal = lazy(() => import('@/shared/pages/ManagementPortal'));
const Toaster = lazy(() => import('@/components/ui/toaster').then((m) => ({ default: m.Toaster })));
const SuperAdminLogin = lazy(() => import('@/modules/admin/pages/superadmin/SuperAdminLogin'));
const SuperAdminDashboard = lazy(() => import('@/modules/admin/pages/superadmin/SuperAdminDashboard'));
const SuperAdminProtectedRoute = lazy(() => import('@/modules/admin/routes/SuperAdminProtectedRoute'));
const MigrationTools = lazy(() => import('@/shared/pages/MigrationTools'));
const Unauthorized = lazy(() => import('@/shared/pages/Unauthorized'));

const DEFAULT_PUBLIC_CONFIG = {
  maintenance_mode: false,
  maintenance_message: '',
  public_notice_enabled: false,
  public_notice_message: '',
  public_notice_variant: 'info',
};

const PUBLIC_CONFIG_CACHE_MS = 15000;
const publicConfigCache = {
  data: null,
  expiresAt: 0,
  promise: null,
};

const normalizePublicConfig = (config = {}) => ({
  ...DEFAULT_PUBLIC_CONFIG,
  ...(config || {}),
  maintenance_mode: booleanValue(config?.maintenance_mode, false),
  public_notice_enabled: booleanValue(config?.public_notice_enabled, false),
});

const fetchPublicConfig = async () => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return DEFAULT_PUBLIC_CONFIG;
  }

  const now = Date.now();
  if (publicConfigCache.data && publicConfigCache.expiresAt > now) {
    return publicConfigCache.data;
  }

  if (publicConfigCache.promise) {
    return publicConfigCache.promise;
  }

  publicConfigCache.promise = (async () => {
    const res = await fetch(apiUrl('/api/public/system-config'), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const payload = await res.json().catch(() => null);

    if (!res.ok || payload?.success === false) {
      throw new Error(payload?.error || `Public config request failed (${res.status})`);
    }

    const data = normalizePublicConfig(payload?.config || {});
    publicConfigCache.data = data;
    publicConfigCache.expiresAt = Date.now() + PUBLIC_CONFIG_CACHE_MS;
    return data;
  })().finally(() => {
    publicConfigCache.promise = null;
  });

  return publicConfigCache.promise;
};

/** ✅ Full-screen overlay (blur + message) */
const SuspendedOverlay = ({ message, onSupport, onLogout }) => {
  return (
    <div className="min-h-screen relative">
      {/* Background blur layer */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-md" />

      {/* Foreground card */}
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-[92vw] sm:w-[28vw] bg-white rounded-xl shadow-lg border p-6 text-center">
          <h1 className="text-2xl font-bold text-red-600">Account Suspended</h1>
          <p className="text-gray-600 mt-2">
            {message || 'Your account is suspended/terminated. Please contact support to resolve this.'}
          </p>

          <div className="mt-6 flex gap-3 justify-center">
            <button
              type="button"
              onClick={onSupport}
              className="px-4 py-2 rounded-lg bg-[#003D82] text-white font-semibold hover:opacity-95"
            >
              Contact Support
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-lg border font-semibold text-gray-700 hover:bg-gray-50"
            >
              Logout
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Tip: Support page open karke message send karo, team aapko help karegi.
          </p>
        </div>
      </div>
    </div>
  );
};

/** ✅ Vendor Suspension Gate */
const VendorSuspensionGate = ({ children }) => {
  const { appType } = useSubdomain();
  const { user, loading, logout } = useVendorAuth();
  const [path, setPath] = useState('');

  useEffect(() => {
    setPath(typeof window !== 'undefined' ? window.location.pathname || '' : '');
  }, []);

  // apply only on vendor app (subdomain vendor.* OR /vendor/* routes)
  const isVendorArea =
    appType === 'vendor' ||
    (typeof window !== 'undefined' && (window.location.pathname || '').startsWith('/vendor'));

  if (!isVendorArea) return children;
  if (loading) return children;

  // ✅ Detect suspended/terminated
  const isSuspended =
    user &&
    (
      user.is_active === false ||
      user.status === 'TERMINATED' ||
      user.account_status === 'SUSPENDED' ||
      user.account_status === 'TERMINATED'
    );

  // ✅ Allow support page even if suspended
  const allowPaths = [
    '/vendor/support',
    '/support', // for vendor subdomain sometimes routes are without /vendor prefix
    '/vendor/logout',
    '/logout',
    '/vendor/login',
    '/login',
    '/vendor/verify',
    '/verify',
  ];

  const currentPath = typeof window !== 'undefined' ? (window.location.pathname || '') : path;
  const isAllowed = allowPaths.some((p) => currentPath.startsWith(p));
  const isAssistedSession = Boolean(user?.impersonation?.active);

  if (isSuspended && !isAllowed && !isAssistedSession) {
    const reason =
      user?.suspension_reason ||
      user?.termination_reason ||
      user?.reason ||
      '';

    return (
      <SuspendedOverlay
        message={reason}
        onSupport={() => {
          // if vendor subdomain, support can be /support
          if (appType === 'vendor') window.location.href = '/support';
          else window.location.href = '/vendor/support';
        }}
        onLogout={async () => {
          try {
            if (logout) await logout();
            else await dbClient.auth.signOut();
          } catch (e) {
            if (import.meta.env.DEV) {
              console.error('Logout failed:', e);
            }
          } finally {
            window.location.replace('/');
          }
        }}
      />
    );
  }

  return children;
};

const MaintenanceGate = ({ children }) => {
  const { appType } = useSubdomain();
  const [loading, setLoading] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const data = await fetchPublicConfig();

        setIsMaintenance(booleanValue(data?.maintenance_mode, false));
        setMessage(data?.maintenance_message || '');
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('[MaintenanceGate] fetch failed:', e);
        }
        setIsMaintenance(false);
        setMessage('');
      } finally {
        setLoading(false);
      }
    };

    run();
    const interval = window.setInterval(run, 30000);
    return () => window.clearInterval(interval);
  }, []);

  // Always allow admin/management
  if (appType === 'admin' || appType === 'management') return children;

  const path = typeof window !== 'undefined' ? (window.location.pathname || '') : '';
  if (path.startsWith('/admin') || path.startsWith('/management') || path.startsWith('/migration-tools')) {
    return children;
  }

  if (loading) return children;

  if (isMaintenance) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <MaintenancePage message={message} />
      </Suspense>
    );
  }

  return children;
};

const publicNoticeClass = (variant) => {
  const v = String(variant || 'info').toLowerCase();
  if (v === 'critical') return 'bg-red-600 text-white border-red-500';
  if (v === 'warning') return 'bg-amber-500 text-black border-amber-400';
  return 'bg-blue-600 text-white border-blue-500';
};

const PublicNoticeGate = ({ children }) => {
  const { appType } = useSubdomain();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ enabled: false, message: '', variant: 'info', maintenance: false });

  useEffect(() => {
    const run = async () => {
      try {
        const data = await fetchPublicConfig();

        setNotice({
          maintenance: booleanValue(data?.maintenance_mode, false),
          enabled: booleanValue(data?.public_notice_enabled, false),
          message: data?.public_notice_message || '',
          variant: data?.public_notice_variant || 'info',
        });
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('[PublicNoticeGate] fetch failed:', e);
        }
        setNotice({ maintenance: false, enabled: false, message: '', variant: 'info' });
      } finally {
        setLoading(false);
      }
    };

    run();
    const interval = window.setInterval(run, 30000);
    return () => window.clearInterval(interval);
  }, []);

  if (loading) return children;

  // Do not show notice in admin areas or during maintenance.
  if (notice.maintenance) return children;
  if (appType === 'admin' || appType === 'management') return children;

  const path = typeof window !== 'undefined' ? window.location.pathname || '' : '';
  if (path.startsWith('/admin') || path.startsWith('/management') || path.startsWith('/migration-tools')) {
    return children;
  }

  if (!notice.enabled || !notice.message) return children;

  return (
    <>
      <div className={`border-b px-4 py-2 text-sm font-medium text-center ${publicNoticeClass(notice.variant)}`}>
        {notice.message}
      </div>
      {children}
    </>
  );
};

const PAGE_STATUS_BYPASS_PREFIXES = ['/superadmin', '/management', '/migration-tools', '/unauthorized'];

const shouldBypassPageStatus = (path = '') => {
  const normalized = path || '/';
  return PAGE_STATUS_BYPASS_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
};

const PublicRouteStatusGate = ({ children }) => {
  const location = useLocation();
  const [status, setStatus] = useState({ blocked: false, message: '' });

  useEffect(() => {
    const path = location.pathname || '/';

    if (shouldBypassPageStatus(path)) {
      setStatus({ blocked: false, message: '' });
      return undefined;
    }

    let cancelled = false;

    const checkPageStatus = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          if (!cancelled) setStatus({ blocked: false, message: '' });
          return;
        }

        const res = await fetch(apiUrl(`/api/public/page-status?route=${encodeURIComponent(path)}`), {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = await res.json().catch(() => null);
        const row = res.ok && payload?.success !== false && Array.isArray(payload?.statuses)
          ? payload.statuses[0]
          : null;

        if (!cancelled) {
          setStatus({
            blocked: booleanValue(row?.is_blanked, false),
            message: row?.error_message || '',
          });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[PublicRouteStatusGate] fetch failed:', error);
        }
        if (!cancelled) setStatus({ blocked: false, message: '' });
      }
    };

    setStatus({ blocked: false, message: '' });

    const initialTimeout = window.setTimeout(checkPageStatus, 5000);
    const interval = window.setInterval(checkPageStatus, 60000);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, [location.pathname]);

  if (status.blocked) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <MaintenancePage message={status.message} />
      </Suspense>
    );
  }

  return children;
};

const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const scrollNow = () => {
      window.scrollTo(0, 0);
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    const raf = window.requestAnimationFrame(scrollNow);
    const timeout = window.setTimeout(scrollNow, 120);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [location.pathname, location.search, location.hash]);

  return null;
};

// This component switches route trees based on subdomain/appType
const AppRoutes = () => {
  const { appType } = useSubdomain();

  if (appType === 'vendor') return <VendorRoutes />;
  if (appType === 'buyer') return <BuyerRoutes />;
  if (appType === 'admin') return <AdminRoutes />;
  if (appType === 'management') return <AdminRoutes />;
  if (appType === 'employee') return <EmployeeRoutes />;
  if (appType === 'directory') return <DirectoryRoutes />;
  if (appType === 'career') return <CareerRoutes />;

  return (
    <Routes>
      <Route path="/management" element={<ManagementPortal />} />

      {/* GLOBAL SUPER ADMIN ACCESS */}
      <Route path="/admin/register/superadmin" element={<SuperAdminLogin />} />
      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
      <Route element={<SuperAdminProtectedRoute />}>
        <Route path="/admin/register/superadmin/dashboard" element={<SuperAdminDashboard />} />
        <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
      </Route>

      {/* MIGRATION TOOLS */}
      <Route path="/migration-tools" element={<MigrationTools />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* SUB-APP MOUNT POINTS */}
      <Route path="/vendor/*" element={<VendorRoutes />} />
      <Route path="/buyer/*" element={<BuyerRoutes />} />
      <Route path="/admin/*" element={<AdminRoutes />} />
      <Route path="/employee/*" element={<EmployeeRoutes />} />
      <Route path="/finance-portal/*" element={<AdminRoutes />} />
      <Route path="/career/*" element={<CareerRoutes />} />
      <Route path="/hr/*" element={<AdminRoutes />} />

      {/* DIRECTORY / PUBLIC PAGES */}
      <Route path="/*" element={<DirectoryRoutes />} />
    </Routes>
  );
};

function App() {
  const nonCriticalReady = useDeferredMount({ delay: 7000, idleTimeout: 9500 });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const pixelId = String(import.meta.env.VITE_META_PIXEL_ID || '').trim();
    if (!pixelId || window.fbq) return undefined;

    window.fbq = function fbq() {
      window.fbq.callMethod
        ? window.fbq.callMethod.apply(window.fbq, arguments)
        : window.fbq.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = window.fbq;
    window.fbq.push = window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = '2.0';
    window.fbq.queue = [];

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');

    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let idleId = null;
    const run = () => {
      locationService.seedLocations().catch((err) => {
        if (import.meta.env.DEV) {
          console.error('Location seeding failed', err);
        }
      });
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 9000 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(run, 8000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <Helmet>
        <title>Indian Trade Mart | B2B Marketplace in India</title>
        <meta
          name="description"
          content="Find verified manufacturers, suppliers, exporters and B2B service providers across India on Indian Trade Mart."
        />
        <meta
          name="keywords"
          content="Indian Trade Mart, B2B marketplace India, manufacturers, suppliers, exporters, business directory"
        />
      </Helmet>

      <PageStatusProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <SubdomainProvider>
            <MaintenanceGate>
              <AuthProvider>
                {nonCriticalReady && <VisitorActivityTracker />}
                <InternalAuthProvider>
                  <VendorAuthProvider>
                    <EmployeeAuthProvider>
                      <SuperAdminProvider>
                        <PublicNoticeGate>
                          <PublicRouteStatusGate>
                            {/* ✅ Vendor suspended gate added here */}
                            <VendorSuspensionGate>
                              <RouteErrorBoundary>
                                <Suspense fallback={<RouteLoadingFallback />}>
                                  <AppRoutes />
                                </Suspense>
                              </RouteErrorBoundary>
                              {nonCriticalReady && <ScrollToTopButton />}
                              {nonCriticalReady && <DeferredAIChatWidget />}
                            </VendorSuspensionGate>
                          </PublicRouteStatusGate>
                        </PublicNoticeGate>
                      </SuperAdminProvider>
                    </EmployeeAuthProvider>
                  </VendorAuthProvider>
                </InternalAuthProvider>
              </AuthProvider>
            </MaintenanceGate>
          </SubdomainProvider>
          {nonCriticalReady && (
            <NonCriticalErrorBoundary>
              <AnalyticsLoader />
            </NonCriticalErrorBoundary>
          )}
        </Router>
      </PageStatusProvider>

      {nonCriticalReady && (
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      )}
    </>
  );
}

export default App;
