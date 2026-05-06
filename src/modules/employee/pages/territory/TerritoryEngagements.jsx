import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { territoryApi } from '@/modules/employee/services/territoryApi';

const TerritoryEngagements = () => {
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState('');
  const [rows, setRows] = useState([]);

  const load = async () => {
    try {
      setLoading(true);
      const data = await territoryApi.getEngagements({
        vendor_id: vendorId || '',
        limit: 200,
      });
      setRows(data || []);
    } catch (error) {
      toast({
        title: 'Failed to load engagements',
        description: error?.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Territory Engagements</h1>
          <p className="text-sm text-slate-600">Monitor plan-selling follow-ups done by sales teams.</p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            placeholder="Filter by vendor UUID"
          />
          <Button onClick={load}>Apply</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Engagements</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid place-items-center h-48 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-slate-500">No engagement records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Type</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Vendor</th>
                    <th className="py-2">Territory</th>
                    <th className="py-2">Sales User</th>
                    <th className="py-2">Follow-up</th>
                    <th className="py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2">{row.engagement_type}</td>
                      <td className="py-2">{row.status}</td>
                      <td className="py-2">
                        <div className="font-medium text-sm">{row.vendor?.company_name || row.vendor_id}</div>
                        <div className="text-xs text-slate-500">
                          {row.vendor?.vendor_id || row.vendor_id}
                        </div>
                        <div className="text-xs text-slate-500">
                          {[row.vendor?.city, row.vendor?.state].filter(Boolean).join(', ') || '—'} • {row.vendor?.pincode || '—'}
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="text-sm">{row.division?.name || row.division_id || '—'}</div>
                        <div className="text-xs text-slate-500">
                          {[row.division?.city?.name, row.division?.state?.name].filter(Boolean).join(', ') || '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          Pincodes: {row.division?.pincode_count || 0}
                        </div>
                      </td>
                      <td className="py-2">{row.sales_user_id || '—'}</td>
                      <td className="py-2">{row.next_follow_up_at || '—'}</td>
                      <td className="py-2">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TerritoryEngagements;
