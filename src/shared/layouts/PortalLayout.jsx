import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, Users, FileText, Settings, LogOut,
  Menu, X, ShieldCheck, HelpCircle, Boxes,
  BarChart3, UserCheck, Ticket, Database, Home, CalendarClock, ClipboardList, Search, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dbClient } from '@/lib/dbClient';
import { useAuth as useVendorAuth } from '@/modules/vendor/context/AuthContext';
import { useInternalAuth } from '@/modules/admin/context/InternalAuthContext';
import MaintenancePage from '@/shared/components/MaintenancePage';
import { Loader2 } from 'lucide-react';
import NotificationBell from '@/shared/components/NotificationBell';
import { getPublicSiteUrl } from '@/shared/lib/publicSite';
import { useSubdomain } from '@/contexts/SubdomainContext';
import { apiUrl } from '@/lib/apiBase';
import { booleanValue } from '@/lib/booleanValue';

const parseSidebarPath = (path = '') => {
  const [pathnamePart, hashPart] = String(path || '').split('#');
  return {
    pathname: pathnamePart || '/',
    hash: hashPart ? `#${hashPart.replace(/^#/, '')}` : '',
  };
};

const SidebarItem = ({ icon: Icon, label, path, collapsed, exact = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname, hash } = parseSidebarPath(path);
  const isHashTarget = Boolean(hash);
  const active = isHashTarget
    ? location.pathname === pathname && location.hash === hash
    : exact
      ? location.pathname === pathname && !location.hash
      : location.pathname.startsWith(pathname);

  const handleClick = (event) => {
    if (!isHashTarget) return;

    event.preventDefault();
    navigate(path);

    if (location.pathname === pathname) {
      const targetId = hash.slice(1);
      const scrollToTarget = () => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      window.requestAnimationFrame(scrollToTarget);
      window.setTimeout(scrollToTarget, 120);
    }
  };

  return (
    <Link to={path} onClick={handleClick}>
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
          active
            ? 'bg-[#003D82] text-white shadow-md'
            : 'text-neutral-600 hover:bg-neutral-100 hover:text-[#003D82]'
        }`}
      >
        <Icon className={`h-5 w-5 ${active ? 'text-white' : 'text-neutral-500 group-hover:text-[#003D82]'}`} />
        {!collapsed && <span className="font-medium text-sm">{label}</span>}
        {active && !collapsed && (
          <motion.div layoutId="activeIndicator" className="ml-auto w-1 h-1 rounded-full bg-white" />
        )}
      </div>
    </Link>
  );
};

const PortalBrand = ({ label, collapsed = false }) => (
  <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'} min-w-0`}>
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-200">
      <img
        src="/itm-mark.png"
        alt="Indian Trade Mart"
        className="h-7 w-7 object-contain"
        loading="eager"
        decoding="async"
      />
    </span>
    {!collapsed ? (
      <span className="min-w-0 truncate text-base font-semibold tracking-tight text-[#003D82]">
        {label}
      </span>
    ) : null}
  </div>
);

const PortalLayout = ({ role }) => {
  const VENDOR_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvePath } = useSubdomain();
  const vendorLoginPath = resolvePath('login', 'vendor');

  const vendorAuth = useVendorAuth();
  const internalAuth = useInternalAuth();

  const isVendor = role === 'VENDOR';
  const user = isVendor ? vendorAuth.user : internalAuth.user;
  const logout = isVendor ? vendorAuth.logout : internalAuth.logout;

  const [pageStatus, setPageStatus] = useState({ isBlocked: false, message: '' });
  const [checkingStatus, setCheckingStatus] = useState(true);
  const vendorIdleTimerRef = useRef(null);

  useEffect(() => {
    const checkPageStatus = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setPageStatus({ isBlocked: false, message: '' });
          return;
        }

        let routeToCheck = location.pathname;
        if (role === 'VENDOR' && location.pathname.startsWith('/vendor')) {
          routeToCheck = '/vendor/dashboard';
        }

        const res = await fetch(apiUrl(`/api/public/page-status?route=${encodeURIComponent(routeToCheck)}`), {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        const payload = await res.json().catch(() => null);
        const data = res.ok && payload?.success !== false && Array.isArray(payload?.statuses)
          ? payload.statuses[0]
          : null;

        if (data && booleanValue(data.is_blanked, false)) {
          setPageStatus({ isBlocked: true, message: data.error_message });
        } else {
          setPageStatus({ isBlocked: false, message: '' });
        }
      } catch {
        setPageStatus({ isBlocked: false, message: '' });
      } finally {
        setCheckingStatus(false);
      }
    };

    checkPageStatus();
    const interval = window.setInterval(checkPageStatus, 15000);

    const channel = dbClient
      .channel('portal_status_check')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'page_status' }, (payload) => {
        const routeToCheck =
          role === 'VENDOR' && location.pathname.startsWith('/vendor')
            ? '/vendor/dashboard'
            : location.pathname;

        if (payload.new.page_route === routeToCheck) {
          setPageStatus({
            isBlocked: booleanValue(payload.new.is_blanked, false),
            message: payload.new.error_message,
          });
        }
      })
      .subscribe();

    return () => {
      window.clearInterval(interval);
      dbClient.removeChannel(channel);
    };
  }, [location.pathname, role]);

  useEffect(() => {
    if (!isVendor || !user?.id) {
      if (vendorIdleTimerRef.current) {
        window.clearTimeout(vendorIdleTimerRef.current);
        vendorIdleTimerRef.current = null;
      }
      return undefined;
    }

    const resetIdleTimer = () => {
      if (vendorIdleTimerRef.current) {
        window.clearTimeout(vendorIdleTimerRef.current);
      }

      vendorIdleTimerRef.current = window.setTimeout(async () => {
        try {
          await logout();
        } finally {
          window.location.replace(`${vendorLoginPath}?reason=timeout`);
        }
      }, VENDOR_IDLE_TIMEOUT_MS);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    });

    resetIdleTimer();

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
      if (vendorIdleTimerRef.current) {
        window.clearTimeout(vendorIdleTimerRef.current);
        vendorIdleTimerRef.current = null;
      }
    };
  }, [isVendor, logout, user?.id]);

  const handleLogout = async () => {
    await logout();
    if (isVendor) {
      window.location.replace('/');
      return;
    }

    switch (role) {
      case 'HR':
        navigate('/hr/login');
        break;
      case 'FINANCE':
        navigate('/finance-portal/login');
        break;
      case 'DATA_ENTRY':
      case 'SUPPORT':
      case 'SALES':
        navigate('/employee/login');
        break;
      default:
        navigate(resolvePath('login', 'admin'));
        break;
    }
  };

  const handleGoHome = () => {
    window.location.href = getPublicSiteUrl(window.location);
  };

  const getNavItems = () => {
    switch (role) {
      case 'VENDOR':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: resolvePath('dashboard', 'vendor') },
          { icon: Package, label: 'Products', path: resolvePath('products', 'vendor') },
          { icon: Users, label: 'Leads', path: resolvePath('leads', 'vendor') },
          { icon: Boxes, label: 'Packages', path: resolvePath('packages', 'vendor') },
          { icon: ShieldCheck, label: 'KYC & Profile', path: resolvePath('kyc', 'vendor') },
          { icon: HelpCircle, label: 'Support', path: resolvePath('support', 'vendor') },
          { icon: Settings, label: 'Settings', path: resolvePath('settings', 'vendor') },
        ];
      case 'ADMIN':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: resolvePath('dashboard', 'admin') },
          { icon: Search, label: 'Search 360', path: resolvePath('search-360', 'admin') },
          { icon: Activity, label: 'Visitor Intel', path: resolvePath('visitor-intelligence', 'admin') },
          { icon: Package, label: 'Vendors', path: resolvePath('vendors', 'admin') },
          { icon: Users, label: 'Buyers', path: resolvePath('buyers', 'admin') },
          { icon: Ticket, label: 'Support Tickets', path: resolvePath('tickets', 'admin') },
          { icon: UserCheck, label: 'KYC Approvals', path: resolvePath('kyc', 'admin') },
          { icon: BarChart3, label: 'Finance', path: resolvePath('finance', 'admin') },
          { icon: ClipboardList, label: 'Sub. Requests', path: resolvePath('subscription-requests', 'admin') },
          { icon: Users, label: 'Staff', path: resolvePath('staff', 'admin') },
          { icon: FileText, label: 'Audit Logs', path: resolvePath('audit-logs', 'admin') },
          { icon: Settings, label: 'Settings', path: resolvePath('settings', 'admin') },
        ];
      case 'FINANCE':
        return [
          { icon: LayoutDashboard, label: 'Finance Dashboard', path: '/finance-portal/dashboard', exact: true },
          { icon: BarChart3, label: 'Payments', path: '/finance-portal/dashboard#payments' },
        ];
      case 'HR':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/hr/dashboard' },
          { icon: Users, label: 'Employees', path: '/hr/staff' },
          { icon: CalendarClock, label: 'Leave Management', path: '/hr/leave' },
        ];
      case 'DATA_ENTRY':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/dataentry/dashboard' },
          { icon: Search, label: 'Search 360', path: '/employee/dataentry/search-360' },
          { icon: Database, label: 'Categories', path: '/employee/dataentry/categories' },
          { icon: Database, label: 'Locations', path: '/employee/dataentry/locations' },
          { icon: Users, label: 'Vendors', path: '/employee/dataentry/vendors' },
          { icon: ShieldCheck, label: 'KYC Approvals', path: '/employee/dataentry/kyc' },
        ];
      case 'SUPPORT':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/support/dashboard' },
          { icon: Search, label: 'Search 360', path: '/employee/support/search-360' },
          { icon: ShieldCheck, label: 'KYC Review', path: '/employee/support/kyc-review' },
          { icon: Ticket, label: 'Tickets', path: '/employee/support/tickets' },
        ];
      case 'SALES':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/sales/dashboard' },
          { icon: Search, label: 'Search 360', path: '/employee/sales/search-360' },
          { icon: Users, label: 'Leads', path: '/employee/sales/leads' },
          { icon: BarChart3, label: 'Pricing Rules', path: '/employee/sales/pricing-rules' },
          { icon: ClipboardList, label: 'Sub. Requests', path: '/employee/sales/subscription-requests' },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const portalName =
    role === 'DATA_ENTRY'
      ? 'Data Entry'
      : role.charAt(0) + role.slice(1).toLowerCase().replace('_', ' ') + ' Portal';

  if (checkingStatus) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  if (pageStatus.isBlocked) {
    return <MaintenancePage message={pageStatus.message} />;
  }

  return (
    <div className="h-screen bg-neutral-50 flex font-sans text-neutral-900 overflow-hidden">
      {/* Sidebar - Desktop */}
      <motion.aside
        initial={false}
        // ✅ width reduced
        animate={{ width: collapsed ? 72 : 230 }}
        className="hidden md:flex flex-col bg-white border-r border-neutral-200 h-screen sticky top-0 z-30 flex-shrink-0"
      >
        <div className={`p-3 flex items-center h-16 border-b border-neutral-100 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003D82]"
              title="Expand sidebar"
            >
              <PortalBrand label={portalName} collapsed />
            </button>
          ) : (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
                <PortalBrand label={portalName} />
              </motion.div>
              <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} className="ml-auto">
                <Menu className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <SidebarItem
              key={item.path}
              {...item}
              collapsed={collapsed}
            />
          ))}
        </div>

        <div className="p-4 border-t border-neutral-100">
          <Button
            variant="ghost"
            className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start'} text-red-600 hover:text-red-700 hover:bg-red-50`}
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-2" />
            {!collapsed && 'Logout'}
          </Button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 sticky top-0 z-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleGoHome}>
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
            <NotificationBell
              userId={user?.user_id || user?.id || null}
              userEmail={user?.email || null}
            />
            <div className="flex items-center gap-3 pl-4 border-l border-neutral-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-neutral-900">{user?.name || user?.email}</p>
                <p className="text-xs text-neutral-500">{role}</p>
              </div>
              <div className="h-9 w-9 bg-[#003D82] rounded-full flex items-center justify-center text-white font-medium">
                {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-white z-50 md:hidden flex flex-col shadow-xl"
            >
              <div className="p-4 border-b border-neutral-100 flex justify-between items-center">
                <PortalBrand label={portalName} />
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                  <SidebarItem
                    key={item.path}
                    {...item}
                    collapsed={false}
                  />
                ))}
              </div>
              <div className="p-4 bg-neutral-50">
                <Button variant="destructive" className="w-full justify-start" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PortalLayout;
