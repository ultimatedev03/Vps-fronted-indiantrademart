import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, Users, FileText, Settings, LogOut,
  Menu, X, ShieldCheck, HelpCircle, ChevronRight, Boxes,
  BarChart3, UserCheck, Ticket, Database, Home, CalendarClock, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth as useVendorAuth } from '@/modules/vendor/context/AuthContext';
import { useInternalAuth } from '@/modules/admin/context/InternalAuthContext';
import MaintenancePage from '@/shared/components/MaintenancePage';
import { Loader2 } from 'lucide-react';
import NotificationBell from '@/shared/components/NotificationBell';
import { getPublicSiteUrl } from '@/shared/lib/publicSite';
import { useSubdomain } from '@/contexts/SubdomainContext';

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
        let routeToCheck = location.pathname;
        if (role === 'VENDOR' && location.pathname.startsWith('/vendor')) {
          routeToCheck = '/vendor/dashboard';
        }

        const { data } = await supabase
          .from('page_status')
          .select('*')
          .eq('page_route', routeToCheck)
          .maybeSingle();

        if (data && data.is_blanked) {
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

    const channel = supabase
      .channel('portal_status_check')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'page_status' }, (payload) => {
        const routeToCheck =
          role === 'VENDOR' && location.pathname.startsWith('/vendor')
            ? '/vendor/dashboard'
            : location.pathname;

        if (payload.new.page_route === routeToCheck) {
          setPageStatus({
            isBlocked: payload.new.is_blanked,
            message: payload.new.error_message,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
          { icon: Database, label: 'Categories', path: '/employee/dataentry/categories' },
          { icon: Database, label: 'Locations', path: '/employee/dataentry/locations' },
          { icon: Users, label: 'Vendors', path: '/employee/dataentry/vendors' },
          { icon: ShieldCheck, label: 'KYC Approvals', path: '/employee/dataentry/kyc' },
        ];
      case 'SUPPORT':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/support/dashboard' },
          { icon: ShieldCheck, label: 'KYC Review', path: '/employee/support/kyc-review' },
          { icon: Ticket, label: 'Tickets', path: '/employee/support/tickets' },
        ];
      case 'SALES':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/sales/dashboard' },
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
        <div className="p-4 flex items-center justify-between h-16 border-b border-neutral-100">
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-lg text-[#003D82] truncate"
            >
              {portalName}
            </motion.span>
          )}
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="ml-auto">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
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
                <span className="font-bold text-xl text-[#003D82]">{portalName}</span>
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
