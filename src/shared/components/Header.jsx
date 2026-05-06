import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { useEmployeeAuth } from '@/modules/employee/context/EmployeeAuthContext';
import { useInternalAuth } from '@/modules/admin/context/InternalAuthContext';
import { Button } from '@/components/ui/button';
import { Search, Menu, LayoutDashboard, LogIn, LogOut, ChevronDown } from 'lucide-react';
import Logo from '@/shared/components/Logo';
import NotificationBell from '@/shared/components/NotificationBell';
import { Sheet, SheetContent, SheetTrigger, SheetHeader } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const user = employeeAuth.user || internalAuth.user || publicAuth.user;
  const logout =
    (employeeAuth.user && employeeAuth.logout) ||
    (internalAuth.user && internalAuth.logout) ||
    publicAuth.logout;
  const dashboardPath = resolveDashboardPath(user?.role);

  const handleLogout = async () => {
    await logout();
    navigate('/');
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
    <header className="fixed top-0 w-full z-50 bg-slate-900 border-b border-slate-800 shadow-md h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          
          {/* Logo & Desktop Nav */}
          <div className="flex items-center gap-4 md:gap-8">
            {/* Mobile Menu Trigger */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-300 hover:text-white"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                  <SheetHeader className="text-left border-b pb-4 mb-4">
                    <Logo className="h-8" />
                  </SheetHeader>
                  <nav className="flex flex-col gap-2">
                    <NavLinks mobile onClick={() => {}} />
                    <div className="border-t my-4 pt-4">
                      {user ? (
                        <>
                           <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-2">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                {user.email?.charAt(0).toUpperCase()}
                              </div>
                              <div className="overflow-hidden">
                                <p className="font-medium text-sm truncate">{user.name || user.email}</p>
                                <p className="text-xs text-gray-500 truncate">{user.role}</p>
                              </div>
                           </div>
                           <Link to={dashboardPath}>
                              <Button className="w-full justify-start" variant="outline">
                                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                              </Button>
                           </Link>
                           <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-red-600 mt-2">
                              Log Out
                           </Button>
                        </>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <Link to="/auth/login" className="w-full">
                            <Button variant="outline" className="w-full justify-start">
                              <LogIn className="mr-2 h-4 w-4" /> Log In
                            </Button>
                          </Link>
                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-gray-500 px-1">Join Free</div>
                            <Link to="/buyer/register" className="w-full block">
                              <Button className="w-full bg-[#00A699] hover:bg-teal-700">As Buyer</Button>
                            </Link>
                            <Link to="/vendor/register" className="w-full block">
                              <Button className="w-full bg-[#003D82] hover:bg-blue-800">As Vendor</Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>

            <div className="flex-shrink-0 flex items-center">
               <Logo variant="light" className="h-6 sm:h-8 w-auto" /> 
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
                   <NotificationBell
                     userId={user?.user_id || user?.id || null}
                     userEmail={user?.email || null}
                   />
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
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="bg-white text-slate-900 hover:bg-gray-100 font-semibold gap-1">
                        Join Free <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Register as</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/buyer/register')}>
                         Buyer (Source Products)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/vendor/register')}>
                         Vendor (Sell Products)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
