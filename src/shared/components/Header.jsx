import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { useEmployeeAuth } from '@/modules/employee/context/EmployeeAuthContext';
import { useInternalAuth } from '@/modules/admin/context/InternalAuthContext';
import { Button } from '@/components/ui/button';
import { Search, Menu, LayoutDashboard, LogIn, LogOut, ChevronDown } from 'lucide-react';
import Logo from '@/shared/components/Logo';

const NotificationBell = lazy(() => import('@/shared/components/NotificationBell'));

const DASHBOARD_PATHS = {
  VENDOR: '/vendor/dashboard',
  BUYER: '/buyer/dashboard',
  ADMIN: '/admin/dashboard',
  SUPERADMIN: '/admin/register/superadmin/dashboard',
  HR: '/hr/dashboard',
  FINANCE: '/finance-portal/dashboard',
  DATA_ENTRY: '/employee/dataentry/dashboard',
  DATAENTRY: '/employee/dataentry/dashboard',
  SUPPORT: '/employee/support/dashboard',
  SALES: '/employee/sales/dashboard',
  MANAGER: '/employee/manager/dashboard',
  VP: '/employee/vp/dashboard',
};

const resolveDashboardPath = (role = '') =>
  DASHBOARD_PATHS[String(role || '').trim().toUpperCase()] || '/';

const Header = () => {
  const publicAuth = useAuth();
  const employeeAuth = useEmployeeAuth();
  const internalAuth = useInternalAuth();
  const navigate = useNavigate();
  const joinMenuRef = useRef(null);
  const user = employeeAuth.user || internalAuth.user || publicAuth.user;
  const logout =
    (employeeAuth.user && employeeAuth.logout) ||
    (internalAuth.user && internalAuth.logout) ||
    publicAuth.logout;
  const dashboardPath = resolveDashboardPath(user?.role);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [joinMenuOpen, setJoinMenuOpen] = useState(false);

  useEffect(() => {
    if (!joinMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (joinMenuRef.current && !joinMenuRef.current.contains(event.target)) {
        setJoinMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setJoinMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [joinMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen || typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    setJoinMenuOpen(false);
    navigate('/');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navigateToRegistration = (path) => {
    setJoinMenuOpen(false);
    setMobileMenuOpen(false);
    navigate(path);
  };

  const NavLinks = ({ mobile = false, onClick = () => {} }) => (
      <>
    <Link 
      to="/" 
      onClick={onClick}
      className={`${mobile ? 'flex items-center p-3 hover:bg-slate-100 rounded-md text-slate-800' : 'text-gray-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm font-medium transition-colors'}`}
    >
      Home
    </Link>

    <Link 
      to="/directory" 
      onClick={onClick}
      className={`${mobile ? 'flex items-center p-3 hover:bg-slate-100 rounded-md text-slate-800' : 'text-gray-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm font-medium transition-colors'}`}
    >
      Directory
    </Link>

    <Link 
      to="/products" 
      onClick={onClick}
      className={`${mobile ? 'flex items-center p-3 hover:bg-slate-100 rounded-md text-slate-800' : 'text-gray-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm font-medium transition-colors'}`}
    >
      Products
    </Link>

    <Link 
      to="/pricing" 
      onClick={onClick}
      className={`${mobile ? 'flex items-center p-3 hover:bg-slate-100 rounded-md text-slate-800' : 'text-gray-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm font-medium transition-colors'}`}
    >
      Pricing
    </Link>

    <a
      href="https://blog.indiantrademart.com"
      onClick={onClick}
      className={`${mobile ? 'flex items-center p-3 hover:bg-slate-100 rounded-md text-slate-800' : 'text-gray-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-md text-sm font-medium transition-colors'}`}
    >
      Blog
    </a>
  </>

  );

  return (
    <header className="fixed top-0 z-50 h-16 w-full border-b border-white/10 bg-[#0b1f33] shadow-md">
      <div className="mx-auto h-full w-[94vw] max-w-[1500px]">
        <div className="flex justify-between items-center h-full">
          
          {/* Logo & Desktop Nav */}
          <div className="flex items-center gap-4 md:gap-8">
            {/* Mobile Menu Trigger */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-300 hover:text-white"
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </Button>
            </div>

            <div className="flex-shrink-0 flex items-center">
               <Logo variant="light" className="h-10 w-auto sm:h-11" showTagline compact={false} />
            </div>
            
            <nav className="hidden md:flex space-x-1">
              <NavLinks />
            </nav>
          </div>
          
          {/* Desktop Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
             <Link
               to="/products"
               className="text-gray-400 hover:text-white transition-colors p-2"
               aria-label="Search products and suppliers"
               title="Search"
             >
                <Search className="w-5 h-5" />
             </Link>
            
            <div className="hidden md:flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                   <Suspense fallback={null}>
                     <NotificationBell
                       userId={user?.user_id || user?.id || null}
                       userEmail={user?.email || null}
                     />
                   </Suspense>
                   <div className="h-6 w-px bg-slate-700 mx-2"></div>
                   <Link to={dashboardPath}>
                      <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-none border border-transparent">
                         Dashboard
                      </Button>
                   </Link>
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={handleLogout}
                     className="text-gray-300 hover:text-white hover:bg-slate-800"
                     aria-label="Log out"
                   >
                      <LogOut className="w-4 h-4" />
                   </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link to="/auth/login">
                    <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-slate-800">Log in</Button>
                  </Link>
                  
                  <div className="relative" ref={joinMenuRef}>
                    <Button
                      size="sm"
                      className="bg-white text-slate-900 hover:bg-gray-100 font-semibold gap-1"
                      aria-haspopup="menu"
                      aria-expanded={joinMenuOpen}
                      onClick={() => setJoinMenuOpen((value) => !value)}
                    >
                        Join Free <ChevronDown className="w-4 h-4" />
                    </Button>
                    {joinMenuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-800 shadow-xl"
                      >
                        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Register as
                        </div>
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => navigateToRegistration('/buyer/register')}
                        >
                          Buyer (Source Products)
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => navigateToRegistration('/vendor/register')}
                        >
                          Vendor (Sell Products)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55"
            aria-label="Close navigation menu"
            onClick={closeMobileMenu}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(320px,92vw)] flex-col overflow-y-auto bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b pb-4">
              <Logo className="h-11 w-auto" showTagline compact={false} />
              <Button variant="ghost" size="icon" onClick={closeMobileMenu} aria-label="Close navigation menu">
                <span className="text-2xl leading-none">&times;</span>
              </Button>
            </div>
            <nav className="flex flex-col gap-2">
              <NavLinks mobile onClick={closeMobileMenu} />
              <div className="my-4 border-t pt-4">
                {user ? (
                  <>
                    <div className="mb-2 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                        {user.email?.charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <p className="truncate text-sm font-medium">{user.name || user.email}</p>
                        <p className="truncate text-xs text-gray-500">{user.role}</p>
                      </div>
                    </div>
                    <Link to={dashboardPath} onClick={closeMobileMenu}>
                      <Button className="w-full justify-start" variant="outline">
                        <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                      </Button>
                    </Link>
                    <Button onClick={handleLogout} variant="ghost" className="mt-2 w-full justify-start text-red-600">
                      Log Out
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Link to="/auth/login" className="w-full" onClick={closeMobileMenu}>
                      <Button variant="outline" className="w-full justify-start">
                        <LogIn className="mr-2 h-4 w-4" /> Log In
                      </Button>
                    </Link>
                    <div className="space-y-2">
                      <div className="px-1 text-sm font-semibold text-gray-500">Join Free</div>
                      <Button
                        className="w-full bg-[#00A699] hover:bg-teal-700"
                        onClick={() => navigateToRegistration('/buyer/register')}
                      >
                        As Buyer
                      </Button>
                      <Button
                        className="w-full bg-[#003D82] hover:bg-blue-800"
                        onClick={() => navigateToRegistration('/vendor/register')}
                      >
                        As Vendor
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </aside>
        </div>
      )}
    </header>
  );
};

export default Header;
