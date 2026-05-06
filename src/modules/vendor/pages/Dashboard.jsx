import React, { useEffect, useMemo, useState } from 'react';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { supabase } from '@/lib/customSupabaseClient';
import Card from '@/shared/components/Card';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  Users,
  AlertTriangle,
  Plus,
  Package,
  MessageSquare,
  CheckCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useAuth } from '@/modules/vendor/context/AuthContext';
import SubscriptionBadge from '@/modules/vendor/components/SubscriptionBadge';
import { toast } from '@/components/ui/use-toast';
import { useSubdomain } from '@/contexts/SubdomainContext';

// ✅ Clickable + Hover premium stats card (FIXED overflow)
const StatsCardWithDetail = ({ label, value, icon: Icon, detail, hint, to }) => {
  const Wrapper = ({ children }) =>
    to ? (
      <Link to={to} className="block focus:outline-none">
        {children}
      </Link>
    ) : (
      <div>{children}</div>
    );

  return (
    <Wrapper>
      <div
        className={[
          "group bg-white border border-slate-200 rounded-xl p-5 shadow-sm overflow-hidden", // ✅ FIX
          "transition-all duration-200 ease-out",
          "hover:-translate-y-0.5 hover:shadow-md hover:border-[#003D82]/30",
          "focus-visible:ring-2 focus-visible:ring-[#003D82]/30 focus-visible:ring-offset-2",
          to ? "cursor-pointer" : "cursor-default"
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          {/* ✅ left content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>

            <p className="text-xs text-slate-500 mt-1 leading-snug break-words">
              {detail}
            </p>

            {/* ✅ FIXED: hint wraps and never overflows */}
            {hint ? (
              <div className="mt-2 flex items-start gap-1 text-[11px] text-slate-500 min-w-0">
                <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
                <p className="leading-snug break-words min-w-0">
                  {hint}
                </p>
              </div>
            ) : null}
          </div>

          {/* ✅ right side icon + view */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200 transition-colors group-hover:bg-[#003D82]/5 group-hover:border-[#003D82]/30">
              <Icon className="w-5 h-5 text-slate-500 transition-colors group-hover:text-[#003D82]" />
            </div>

            {to ? (
              <div className="text-[11px] text-slate-400 inline-flex items-center gap-1 group-hover:text-[#003D82] transition-colors">
                <span>View</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Wrapper>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { vendorId: paramVendorId } = useParams();
  const { resolvePath } = useSubdomain();

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalLeads: 0,
    totalMessages: 0,
    profileCompletion: 0,
    kycStatus: 'PENDING',
    trustScore: 0,
    rating: 0,
    vendorId: null,
  });

  const [vendorId, setVendorId] = useState(null);
  const [recentProducts, setRecentProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [data, products, sub] = await Promise.all([
          vendorApi.dashboard.getStats(),
          vendorApi.products.list(),
          vendorApi.subscriptions.getCurrent()
        ]);

        const normalized = {
          totalProducts: data?.totalProducts ?? 0,
          totalLeads: data?.totalLeads ?? 0,
          totalMessages: data?.totalMessages ?? 0,
          profileCompletion: data?.profileCompletion ?? 0,
          kycStatus: data?.kycStatus ?? 'PENDING',
          trustScore: data?.trustScore ?? 0,
          rating: data?.rating ?? 0,
          vendorId: data?.vendorId ?? null,
        };

        setStats(normalized);

        const vendId = normalized?.vendorId;
        setVendorId(vendId);

        setRecentProducts(products?.slice(0, 3) || []);
        setSubscription(sub || null);

        if (vendId && !paramVendorId) {
          navigate(resolvePath(`${vendId}/dashboard`, 'vendor'), { replace: true });
        }
      } catch (error) {
        console.error("Failed to load dashboard", error);
      } finally {
        setLoading(false);
        setSubscriptionLoading(false);
      }
    };

    loadDashboard();

    // Subscribe to real-time vendor updates for KYC status changes
    const subscription = supabase
      .channel('vendor_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vendors',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('🔄 Vendor updated:', payload);
          if (payload.new?.kyc_status) {
            setStats(prev => ({
              ...prev,
              kycStatus: payload.new.kyc_status
            }));
          }
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [paramVendorId, navigate, resolvePath, user?.id]);

  const ownerName = useMemo(() => {
    return (
      user?.ownerName ||
      user?.owner_name ||
      user?.name ||
      (user?.email ? user.email.split('@')[0] : '') ||
      'Vendor'
    );
  }, [user]);

  // ✅ Profile completion explanation (40% ka meaning)
  const profileHint = useMemo(() => {
    const p = Number(stats.profileCompletion || 0);
    if (p >= 90) return 'Great! Your profile is almost complete.';
    if (p >= 60) return 'Add bank + KYC docs to unlock full features.';
    return 'Fill profile + upload KYC documents to unlock full features.';
  }, [stats.profileCompletion]);

  const subscriptionsPath = resolvePath('subscriptions', 'vendor');
  const productAddPath = resolvePath('products/add', 'vendor');
  const productsPath = resolvePath('products', 'vendor');
  const leadsPath = resolvePath('leads', 'vendor');
  const supportPath = resolvePath('support', 'vendor');
  const messagesPath = resolvePath('messages', 'vendor');
  const profilePath = resolvePath('profile', 'vendor');
  const profileKycPath = `${profilePath}?tab=kyc`;
  const profilePrimaryPath = `${profilePath}?tab=primary`;

  return (
    <div className="space-y-6">
      {/* Welcome & KYC Status */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">Hello, {ownerName}! 👋</h2>
          <p className="text-neutral-500">Here's what's happening with your store today.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Subscription Status */}
          <Link to={subscriptionsPath} className="block">
            <SubscriptionBadge subscription={subscription} loading={subscriptionLoading} />
          </Link>

          {/* KYC Status */}
          {/* Subscription Expiration Alert */}
          {subscription && (() => {
            const endDate = new Date(subscription.end_date);
            const today = new Date();
            // Set time to start of day for accurate calculation
            today.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;
            const isExpired = daysRemaining < 0;

            if (isExpired) {
              return (
                <Link to={subscriptionsPath} className="block">
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer">
                    <AlertTriangle className="h-5 w-5" />
                    <div>
                      <p className="font-semibold text-sm">Subscription Expired</p>
                      <p className="text-xs">Renew now to restore access to leads.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2 border-red-600 text-red-800 hover:bg-red-100"
                    >
                      Renew Now
                    </Button>
                  </div>
                </Link>
              );
            }

            if (isExpiringSoon) {
              return (
                <Link to={subscriptionsPath} className="block">
                  <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer">
                    <AlertTriangle className="h-5 w-5" />
                    <div>
                      <p className="font-semibold text-sm">Plan Expiring Soon</p>
                      <p className="text-xs">Your {subscription.vendor_plans?.name} plan expires in {daysRemaining} days.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2 border-orange-600 text-orange-800 hover:bg-orange-100"
                    >
                      Renew
                    </Button>
                  </div>
                </Link>
              );
            }

            return null;
          })()}

          {['VERIFIED', 'APPROVED'].includes(stats.kycStatus) ? (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg flex items-center gap-2 hover:shadow-sm transition-shadow">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">KYC Approved ✓</span>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center gap-3 hover:shadow-sm transition-shadow">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="font-semibold text-sm">KYC {stats.kycStatus}</p>
                <p className="text-xs">Complete verification to unlock all features.</p>
              </div>
              <Link to={profileKycPath}>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2 border-yellow-600 text-yellow-800 hover:bg-yellow-100"
                >
                  Verify Now
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCardWithDetail
          label="Total Products"
          value={stats.totalProducts}
          icon={Package}
          detail="Listed products in your catalog."
          hint="Add more products to increase visibility."
          to={productsPath}
        />

        <StatsCardWithDetail
          label="Active Leads"
          value={stats.totalLeads}
          icon={Users}
          detail="New buyer inquiries received."
          hint="Reply fast to win more orders."
          to={leadsPath}
        />

        <StatsCardWithDetail
          label="Messages"
          value={stats.totalMessages}
          icon={MessageSquare}
          detail="Support / buyer messages pending."
          hint="Open messages and respond."
          to={messagesPath}
        />

        <StatsCardWithDetail
          label="Profile Completion"
          value={`${stats.profileCompletion}%`}
          icon={ShoppingCart}
          detail="How much of your business profile is filled."
          hint={profileHint}
          to={profilePrimaryPath}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendor ID Card */}
        <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <Card.Header>
            <Card.Title>Your Vendor ID</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2">
            <p className="text-sm text-neutral-600">Use this ID for all support requests and transactions</p>

            <div className="bg-neutral-50 p-3 rounded font-mono text-center text-lg font-bold text-[#003D82] break-all min-h-[3rem] flex items-center justify-center border border-slate-200">
              {loading ? (
                <span className="text-blue-500 animate-pulse">Loading...</span>
              ) : vendorId ? (
                vendorId
              ) : (
                <span className="text-neutral-400">No vendor ID assigned</span>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full hover:border-[#003D82] hover:text-[#003D82]"
              onClick={() => {
                if (vendorId) {
                  navigator.clipboard.writeText(vendorId);
                  toast({ title: 'Vendor ID copied!' });
                }
              }}
              disabled={!vendorId}
            >
              Copy ID
            </Button>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="h-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
            <Card.Header>
              <Card.Title>Quick Actions</Card.Title>
            </Card.Header>
            <Card.Content className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Link to={productAddPath} className="block w-full">
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-neutral-600 hover:text-[#003D82] hover:border-[#003D82] hover:bg-[#003D82]/5 transition-colors"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Add Product
                </Button>
              </Link>

              <Link to={leadsPath} className="block w-full">
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-neutral-600 hover:text-[#003D82] hover:border-[#003D82] hover:bg-[#003D82]/5 transition-colors"
                >
                  <Users className="mr-2 h-5 w-5" />
                  View Leads
                </Button>
              </Link>

              <Link to={supportPath} className="block w-full">
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-neutral-600 hover:text-[#003D82] hover:border-[#003D82] hover:bg-[#003D82]/5 transition-colors"
                >
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Support
                </Button>
              </Link>
            </Card.Content>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Performance Analytics Chart */}
        <div className="lg:col-span-2">
          <Card className="h-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-[#003D82]/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <Card.Header>
              <Card.Title className="text-slate-800">Performance Overview (7 Days)</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={[
                      { name: 'Mon', views: 40, leads: 24 },
                      { name: 'Tue', views: 30, leads: 13 },
                      { name: 'Wed', views: 50, leads: 48 },
                      { name: 'Thu', views: 27, leads: 39 },
                      { name: 'Fri', views: 80, leads: 50 },
                      { name: 'Sat', views: 90, leads: 60 },
                      { name: 'Sun', views: 110, leads: 85 },
                    ]}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00A699" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00A699" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#003D82" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#003D82" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                    <Area type="monotone" dataKey="views" stroke="#00A699" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
                    <Area type="monotone" dataKey="leads" stroke="#003D82" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* Recent Products */}
        <div className="lg:col-span-1">
          <Card className="h-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
            <Card.Header>
              <Card.Title>Recent Products</Card.Title>
            </Card.Header>
            <Card.Content>
              {recentProducts.length > 0 ? (
                <div className="space-y-3">
                  {recentProducts.map(product => (
                    <div
                      key={product.id}
                      className="flex justify-between items-start p-3 bg-neutral-50 rounded border border-slate-200 hover:border-[#003D82]/30 hover:bg-white transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-neutral-800">{product.name}</p>
                        <p className="text-xs text-neutral-500">Status: {product.status}</p>
                      </div>
                      <span className="text-sm font-bold text-[#00A699]">₹{product.price}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                  <Package className="w-10 h-10 text-slate-300 mb-3" />
                  <span>No products yet.</span>
                  <Link to={productAddPath} className="text-[#003D82] font-semibold hover:underline mt-1">
                    Add one now
                  </Link>
                </div>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
