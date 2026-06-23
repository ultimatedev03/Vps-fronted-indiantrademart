import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
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

const MaintenancePage = lazy(() => import('@/shared/components/MaintenancePage'));

// Route Modules (lazy)
const VendorRoutes = lazy(() => import('@/modules/vendor/routes').then((m) => ({ default: m.VendorRoutes })));
const BuyerRoutes = lazy(() => import('@/modules/buyer/routes').then((m) => ({ default: m.BuyerRoutes })));
const AdminRoutes = lazy(() => import('@/modules/admin/routes').then((m) => ({ default: m.AdminRoutes })));
const EmployeeRoutes = lazy(() => import('@/modules/employee/routes').then((m) => ({ default: m.EmployeeRoutes })));
const DirectoryRoutes = lazy(() => import('@/modules/directory/routes').then((m) => ({ default: m.DirectoryRoutes })));
const CareerRoutes = lazy(() => import('@/modules/career/routes').then((m) => ({ default: m.CareerRoutes })));

const ManagementPortal = lazy(() => import('@/shared/pages/ManagementPortal'));
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

const fetchPublicConfig = async () => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return DEFAULT_PUBLIC_CONFIG;
  }

  const res = await fetch(apiUrl('/api/public/system-config'), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const payload = await res.json().catch(() => null);

  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.error || `Public config request failed (${res.status})`);
  }

  return {
    ...DEFAULT_PUBLIC_CONFIG,
    ...(payload?.config || {}),
    maintenance_mode: booleanValue(payload?.config?.maintenance_mode, false),
    public_notice_enabled: booleanValue(payload?.config?.public_notice_enabled, false),
  };
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

    checkPageStatus();
    const interval = window.setInterval(checkPageStatus, 10000);

    return () => {
      cancelled = true;
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
  useEffect(() => {
    locationService.seedLocations().catch((err) => {
      if (import.meta.env.DEV) {
        console.error('Location seeding failed', err);
      }
    });
  }, []);

  return (
    <>
      <Helmet>
        <title>IndianTradeMart - B2B Marketplace</title>
      </Helmet>

      <PageStatusProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <SubdomainProvider>
            <MaintenanceGate>
              <AuthProvider>
                <VisitorActivityTracker />
                <InternalAuthProvider>
                  <VendorAuthProvider>
                    <EmployeeAuthProvider>
                      <SuperAdminProvider>
                        <PublicNoticeGate>
                          <PublicRouteStatusGate>
                            {/* ✅ Vendor suspended gate added here */}
                            <VendorSuspensionGate>
                              <Suspense fallback={null}>
                                <AppRoutes />
                              </Suspense>
                              <ScrollToTopButton />
                              <DeferredAIChatWidget />
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
        </Router>
      </PageStatusProvider>

      <AnalyticsLoader />
      <Toaster />
    </>
  );
}

export default App;
