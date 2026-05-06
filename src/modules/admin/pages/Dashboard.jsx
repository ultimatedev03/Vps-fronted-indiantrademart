import React, { useEffect, useState } from 'react';
import { adminApi } from '@/modules/admin/services/adminApi';
import StatsCard from '@/shared/components/StatsCard';
import { 
  Users, ShoppingBag, DollarSign, ChevronDown, ChevronRight,
  Package, UserCheck, Ticket,
  ArrowUpRight, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useInternalAuth } from '@/modules/admin/context/InternalAuthContext';
import { useSubdomain } from '@/contexts/SubdomainContext';

const AdminDashboard = () => {
  const { user: internalUser, isLoading: internalLoading } = useInternalAuth();
  const { resolvePath } = useSubdomain();
  const [stats, setStats] = useState({ 
    totalUsers: 0, 
    activeVendors: 0, 
    totalOrders: 0, 
    totalRevenue: 0,
    totalBuyers: 0,
    totalProducts: 0,
    pendingKyc: 0,
    openTickets: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);
  const [recentVendors, setRecentVendors] = useState([]);
  const [dataEntryPerf, setDataEntryPerf] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCreator, setExpandedCreator] = useState(null);
  const [creatorVendors, setCreatorVendors] = useState({});

  useEffect(() => {
    if (internalLoading) return;

    const currentRole = String(internalUser?.role || '').toUpperCase();
    const canLoadDashboard = currentRole === 'ADMIN';

    if (!canLoadDashboard) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const [overview, orders, performance, tickets, vendors] = await Promise.all([
          adminApi.getDashboardOverview(),
          adminApi.getRecentOrders(),
          adminApi.getDataEntryPerformance(),
          adminApi.getRecentTickets(5),
          adminApi.getRecentVendors(5),
        ]);

        if (cancelled) return;
        setStats(overview);
        setRecentOrders(orders || []);
        setDataEntryPerf(performance || []);
        setRecentTickets(tickets || []);
        setRecentVendors(vendors || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [internalLoading, internalUser?.role]);

  const handleExpandCreator = async (creatorId) => {
    if (expandedCreator === creatorId) {
      setExpandedCreator(null);
      return;
    }
    setExpandedCreator(creatorId);
    if (!creatorVendors[creatorId]) {
      const vendors = await adminApi.getVendorsByCreator(creatorId);
      setCreatorVendors(prev => ({ ...prev, [creatorId]: vendors }));
    }
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      'OPEN': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'IN_PROGRESS': 'bg-blue-100 text-blue-800 border-blue-200',
      'CLOSED': 'bg-green-100 text-green-800 border-green-200',
      'RESOLVED': 'bg-green-100 text-green-800 border-green-200'
    };
    return statusStyles[status] || 'bg-gray-100 text-gray-800';
  };

  const getKycBadge = (status) => {
    const styles = {
      'APPROVED': 'bg-green-100 text-green-800',
      'SUBMITTED': 'bg-yellow-100 text-yellow-800',
      'PENDING': 'bg-gray-100 text-gray-800',
      'REJECTED': 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const kycPath = resolvePath('kyc', 'admin');
  const ticketsPath = resolvePath('tickets', 'admin');
  const vendorsPath = resolvePath('vendors', 'admin');
  const buyersPath = resolvePath('buyers', 'admin');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#003D82]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
      </div>
      
      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Total Revenue" 
          value={`₹${stats.totalRevenue.toLocaleString()}`} 
          icon={DollarSign} 
          trend="+8% this month" 
          trendUp={true} 
        />
        <StatsCard 
          title="Active Vendors" 
          value={stats.activeVendors} 
          icon={ShoppingBag} 
          trend="+12% this week" 
          trendUp={true} 
        />
        <StatsCard 
          title="Total Buyers" 
          value={stats.totalBuyers} 
          icon={Users} 
          trend="+5% this week" 
          trendUp={true} 
        />
        <StatsCard 
          title="Total Products" 
          value={stats.totalProducts} 
          icon={Package} 
          trend="+15 today" 
          trendUp={true} 
        />
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to={kycPath}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-yellow-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending KYC</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingKyc}</p>
              </div>
              <UserCheck className="h-8 w-8 text-yellow-500" />
            </CardContent>
          </Card>
        </Link>
        
        <Link to={ticketsPath}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-red-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Open Tickets</p>
                <p className="text-2xl font-bold text-red-600">{stats.openTickets}</p>
              </div>
              <Ticket className="h-8 w-8 text-red-500" />
            </CardContent>
          </Card>
        </Link>
        
        <Link to={vendorsPath}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Manage Vendors</p>
                <p className="text-2xl font-bold text-blue-600">{stats.activeVendors}</p>
              </div>
              <ShoppingBag className="h-8 w-8 text-blue-500" />
            </CardContent>
          </Card>
        </Link>
        
        <Link to={buyersPath}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Manage Buyers</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalBuyers}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Support Tickets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Support Tickets</CardTitle>
            <Link to={ticketsPath}>
              <Button variant="ghost" size="sm" className="text-[#003D82]">
                View All <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentTickets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Ticket className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No support tickets yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTickets.map(ticket => (
                  <div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-gray-500">
                        {ticket.vendors?.company_name || ticket.buyers?.full_name || 'Unknown'} • {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge variant="outline" className={`text-xs ${ticket.priority === 'HIGH' ? 'border-red-300 text-red-600' : ''}`}>
                        {ticket.priority || 'MEDIUM'}
                      </Badge>
                      <Badge className={`text-xs ${getStatusBadge(ticket.status)}`}>
                        {ticket.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Vendors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Vendors</CardTitle>
            <Link to={vendorsPath}>
              <Button variant="ghost" size="sm" className="text-[#003D82]">
                View All <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentVendors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No vendors yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentVendors.map(vendor => (
                  <div key={vendor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{vendor.company_name}</p>
                      <p className="text-xs text-gray-500">
                        {vendor.owner_name} • {new Date(vendor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={`text-xs ${getKycBadge(vendor.kyc_status)}`}>
                      {vendor.kyc_status || 'PENDING'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Lead Purchases */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Recent Lead Purchases</CardTitle></CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No recent purchases</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.slice(0, 5).map(order => (
                  <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{order.vendor?.company_name || 'Unknown Vendor'}</p>
                      <p className="text-xs text-gray-500">{new Date(order.purchase_date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">₹{order.amount}</p>
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        {order.payment_status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Entry Performance */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Data Entry Performance</CardTitle></CardHeader>
          <CardContent>
            {dataEntryPerf.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No data entry employees</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Vendors</TableHead>
                    <TableHead className="text-center">Products</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataEntryPerf.map(emp => (
                    <React.Fragment key={emp.id}>
                      <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => handleExpandCreator(emp.id)}>
                        <TableCell>
                          {expandedCreator === emp.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                        </TableCell>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-center font-bold text-blue-600">{emp.vendorsCreated}</TableCell>
                        <TableCell className="text-center">{emp.productsListed}</TableCell>
                      </TableRow>
                      {expandedCreator === emp.id && (
                        <TableRow className="bg-slate-50">
                          <TableCell></TableCell>
                          <TableCell colSpan={3}>
                            <div className="p-2 max-h-60 overflow-auto">
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Created Vendors</h4>
                              {creatorVendors[emp.id] ? (
                                <div className="space-y-2">
                                  {creatorVendors[emp.id].map(v => (
                                    <div key={v.id} className="flex justify-between text-sm border-b pb-1">
                                      <span>{v.company_name}</span>
                                      <span className="text-gray-500">{v.products?.length || 0} products</span>
                                    </div>
                                  ))}
                                  {creatorVendors[emp.id].length === 0 && <p className="text-xs text-gray-400">No vendors created yet.</p>}
                                </div>
                              ) : <p className="text-xs">Loading...</p>}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
