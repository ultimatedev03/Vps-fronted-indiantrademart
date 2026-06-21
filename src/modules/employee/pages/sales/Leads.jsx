import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { salesApi } from '@/modules/employee/services/salesApi';
import { Search, Send, DollarSign, Eye, Loader2 } from 'lucide-react';

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB');
};

const getLeadTitle = (lead) =>
  lead?.title ||
  lead?.product_name ||
  lead?.service_name ||
  lead?.requirement_title ||
  lead?.name ||
  'Untitled Lead';

const getLeadBudgetNumber = (lead) => {
  const value = Number(lead?.budget ?? lead?.budget_amount ?? lead?.price ?? lead?.amount ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const formatLeadBudget = (lead) =>
  `₹${getLeadBudgetNumber(lead).toLocaleString('en-IN')}`;

const getLeadCategory = (lead) =>
  lead?.category || lead?.category_name || lead?.sub_category || lead?.head_category || '-';

const getLeadRegion = (lead) =>
  [lead?.city, lead?.state].filter(Boolean).join(', ') || lead?.location || '-';

const getLeadSource = (lead) => {
  const value = String(lead?.source || lead?.lead_origin || (lead?.vendor_id ? 'DIRECT' : 'MARKETPLACE'))
    .trim()
    .toUpperCase();
  return value ? value.replaceAll('_', ' ') : 'MARKETPLACE';
};

const getLeadStatus = (lead) => String(lead?.status || 'AVAILABLE').trim().toUpperCase() || 'AVAILABLE';

const getLeadStatusLabel = (status) => String(status || 'AVAILABLE').replaceAll('_', ' ');

const getStatusBadgeClass = (status) => {
  const value = String(status || 'AVAILABLE').trim().toUpperCase();
  if (['AVAILABLE', 'OPEN'].includes(value)) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (['SENT_TO_VENDOR', 'IN_PROGRESS'].includes(value)) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (['SOLD', 'CLOSED', 'CONVERTED', 'PURCHASED'].includes(value)) return 'bg-green-100 text-green-800 border-green-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
};

const getShortId = (id) => {
  const value = String(id || '-').trim();
  if (!value || value === '-') return '-';
  return value.length > 8 ? `${value.slice(0, 6)}...` : value;
};

const tableHeadClass =
  'sticky top-0 z-20 bg-slate-50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500';
const tableCellClass = 'px-3 py-2.5 align-middle text-[12px] text-slate-700';

const Leads = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageInfo, setPageInfo] = useState({ hasMore: false, nextCursor: null });
  const [selectedLead, setSelectedLead] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [priceForm, setPriceForm] = useState({ budget: '', sales_note: '' });
  const [actionLoadingId, setActionLoadingId] = useState('');

  const loadLeads = async ({ cursor = '', append = false } = {}) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const data = await salesApi.getLeadsPage({ limit: 120, cursor });
      setLeads((prev) => (append ? [...prev, ...(data.leads || [])] : data.leads || []));
      setPageInfo(data.pageInfo || { hasMore: false, nextCursor: null });
    } catch (error) {
      console.error('Failed to load leads:', error);
      toast({
        title: 'Lead load failed',
        description: error?.message || 'Unable to load leads',
        variant: 'destructive',
      });
      setLeads([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const loadMoreLeads = () => {
    if (!pageInfo?.hasMore || !pageInfo?.nextCursor) return;
    loadLeads({ cursor: pageInfo.nextCursor, append: true });
  };

  const filteredLeads = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    const selectedRegion = String(regionFilter || 'ALL');
    const selectedStatus = String(statusFilter || 'ALL');

    return (leads || []).filter((lead) => {
      const region = getLeadRegion(lead);
      const status = getLeadStatus(lead);
      if (selectedRegion !== 'ALL' && region !== selectedRegion) return false;
      if (selectedStatus !== 'ALL' && status !== selectedStatus) return false;
      if (!query) return true;

      return [
        lead?.id,
        getLeadTitle(lead),
        getLeadCategory(lead),
        getLeadRegion(lead),
        getLeadSource(lead),
        lead?.status,
        lead?.description,
        lead?.message,
        lead?.buyer_name,
        lead?.buyer_email,
        lead?.buyer_phone,
        lead?.company_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [leads, regionFilter, searchTerm, statusFilter]);

  const regionOptions = useMemo(() => {
    const values = new Set();
    (leads || []).forEach((lead) => {
      const region = getLeadRegion(lead);
      if (region && region !== '-') values.add(region);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const statusOptions = useMemo(() => {
    const counts = new Map();
    (leads || []).forEach((lead) => {
      const status = getLeadStatus(lead);
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([status, count]) => ({ status, count }));
  }, [leads]);

  const queueStats = useMemo(() => {
    const rows = leads || [];
    const available = rows.filter((lead) => ['AVAILABLE', 'OPEN'].includes(getLeadStatus(lead))).length;
    const active = rows.filter((lead) => ['SENT_TO_VENDOR', 'IN_PROGRESS'].includes(getLeadStatus(lead))).length;
    const won = rows.filter((lead) => ['PURCHASED', 'SOLD', 'CONVERTED', 'CLOSED'].includes(getLeadStatus(lead))).length;
    const value = rows.reduce((sum, lead) => sum + getLeadBudgetNumber(lead), 0);
    return {
      total: rows.length,
      available,
      active,
      won,
      value: `₹${value.toLocaleString('en-IN')}`,
    };
  }, [leads]);

  const updateLeadRow = (updatedLead) => {
    if (!updatedLead?.id) return;
    setLeads((prev) => prev.map((lead) => (lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead)));
    setSelectedLead((prev) => (prev?.id === updatedLead.id ? { ...prev, ...updatedLead } : prev));
  };

  const openDetails = (lead) => {
    setSelectedLead(lead);
    setDetailsOpen(true);
  };

  const openPriceDialog = (lead) => {
    setSelectedLead(lead);
    setPriceForm({
      budget: String(getLeadBudgetNumber(lead) || ''),
      sales_note: String(lead?.sales_note || '').trim(),
    });
    setPriceDialogOpen(true);
  };

  const handleSendToVendor = async (lead) => {
    const leadId = String(lead?.id || '').trim();
    if (!leadId) return;

    setActionLoadingId(`send:${leadId}`);
    try {
      const updatedLead = await salesApi.updateLeadStatus(leadId, 'SENT_TO_VENDOR');
      updateLeadRow(updatedLead);
      toast({
        title: 'Lead forwarded',
        description: 'Lead status updated to Sent To Vendor.',
      });
    } catch (error) {
      toast({
        title: 'Forward failed',
        description: error?.message || 'Could not update lead status',
        variant: 'destructive',
      });
    } finally {
      setActionLoadingId('');
    }
  };

  const handleSavePrice = async () => {
    const leadId = String(selectedLead?.id || '').trim();
    const nextBudget = Number(priceForm.budget);

    if (!leadId) return;
    if (!Number.isFinite(nextBudget) || nextBudget < 0) {
      toast({
        title: 'Invalid budget',
        description: 'Enter a valid non-negative price',
        variant: 'destructive',
      });
      return;
    }

    setActionLoadingId(`price:${leadId}`);
    try {
      const updatedLead = await salesApi.updateLead(leadId, {
        budget: nextBudget,
        sales_note: String(priceForm.sales_note || '').trim() || null,
      });
      updateLeadRow(updatedLead);
      setPriceDialogOpen(false);
      toast({
        title: 'Price updated',
        description: 'Lead pricing has been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Price update failed',
        description: error?.message || 'Could not update lead price',
        variant: 'destructive',
      });
    } finally {
      setActionLoadingId('');
    }
  };

  return (
    <div className="space-y-3 text-slate-950">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">Lead Management</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage buyer requirements, pricing, and vendor handoff in one compact queue.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-[640px]">
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="ALL">All regions</option>
            {regionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="ALL">All statuses</option>
            {statusOptions.map(({ status, count }) => (
              <option key={status} value={status}>
                {getLeadStatusLabel(status)} ({count})
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-neutral-500" />
            <Input
              placeholder="Search leads..."
              className="h-8 pl-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total Leads</p>
          <p className="mt-0.5 text-lg font-semibold leading-tight text-slate-950">{queueStats.total}</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Available</p>
          <p className="mt-0.5 text-lg font-semibold leading-tight text-amber-900">{queueStats.available}</p>
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">In Progress</p>
          <p className="mt-0.5 text-lg font-semibold leading-tight text-blue-900">{queueStats.active}</p>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Pipeline Value</p>
          <p className="mt-0.5 truncate text-lg font-semibold leading-tight text-emerald-900" title={queueStats.value}>
            {queueStats.value}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-lg shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Lead Queue</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Buyer, requirement, budget, and next action in one row.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              {filteredLeads.length} of {leads.length}
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {queueStats.won} won
            </span>
            {pageInfo?.hasMore ? (
              <Button variant="outline" size="sm" onClick={loadMoreLeads} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load more
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[calc(100vh-305px)] min-h-[430px] overflow-y-auto overflow-x-hidden bg-white pb-2 [scrollbar-gutter:stable]">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[26%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
                <col className="w-[7%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={tableHeadClass}>ID</th>
                  <th className={tableHeadClass}>Requirement</th>
                  <th className={tableHeadClass}>Buyer</th>
                  <th className={tableHeadClass}>Region</th>
                  <th className={tableHeadClass}>Budget</th>
                  <th className={tableHeadClass}>Status</th>
                  <th className={tableHeadClass}>Posted</th>
                  <th className={`${tableHeadClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-b-0">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-500">
                    No leads found.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="group border-b border-slate-100 transition-colors hover:bg-slate-50">
                    <td className={`${tableCellClass} font-semibold text-slate-900`}>
                      <span className="block truncate" title={String(lead.id || '-')}>
                        {getShortId(lead.id)}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <button
                        type="button"
                        className="block max-w-full truncate text-left font-semibold text-slate-950 hover:text-blue-700"
                        title={getLeadTitle(lead)}
                        onClick={() => openDetails(lead)}
                      >
                        {getLeadTitle(lead)}
                      </button>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {getLeadCategory(lead) !== '-' ? getLeadCategory(lead) : lead?.description || lead?.message || 'Requirement details pending'}
                      </p>
                    </td>
                    <td className={tableCellClass}>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900" title={lead?.buyer_name || '-'}>
                          {lead?.buyer_name || '-'}
                        </p>
                        <p className="truncate text-[11px] text-slate-500" title={lead?.buyer_phone || lead?.buyer_email || '-'}>
                          {lead?.buyer_phone || lead?.buyer_email || '-'}
                        </p>
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <span className="block truncate" title={getLeadRegion(lead)}>{getLeadRegion(lead)}</span>
                    </td>
                    <td className={`${tableCellClass} font-medium text-slate-950`}>{formatLeadBudget(lead)}</td>
                    <td className={tableCellClass}>
                      <Badge variant="outline" className={`h-6 max-w-full px-2 text-[11px] ${getStatusBadgeClass(lead.status)}`}>
                        <span className="truncate">{getLeadStatusLabel(lead?.status)}</span>
                      </Badge>
                      <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-slate-400">
                        {getLeadSource(lead)}
                      </p>
                    </td>
                    <td className={tableCellClass}>{formatDate(lead?.created_at || lead?.date)}</td>
                    <td className={`${tableCellClass} text-right`}>
                      <div className="flex justify-end gap-1">
                        <Button className="h-7 w-7" size="icon" variant="ghost" title="View Details" onClick={() => openDetails(lead)}>
                          <Eye className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                        <Button
                          className="h-7 w-7"
                          size="icon"
                          variant="ghost"
                          title="Send to Vendor"
                          onClick={() => handleSendToVendor(lead)}
                          disabled={actionLoadingId === `send:${lead.id}`}
                        >
                          {actionLoadingId === `send:${lead.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-green-600" />
                          ) : (
                            <Send className="h-3.5 w-3.5 text-green-600" />
                          )}
                        </Button>
                        <Button className="h-7 w-7" size="icon" variant="ghost" title="Change Price" onClick={() => openPriceDialog(lead)}>
                          <DollarSign className="h-3.5 w-3.5 text-amber-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              </tbody>
              <tfoot aria-hidden="true">
                <tr>
                  <td colSpan={8} className="h-2 bg-white p-0" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
          </DialogHeader>
          {selectedLead ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Lead ID:</span> {selectedLead.id}
              </div>
              <div>
                <span className="text-gray-500">Requirement:</span> {getLeadTitle(selectedLead)}
              </div>
              <div>
                <span className="text-gray-500">Category:</span> {getLeadCategory(selectedLead)}
              </div>
              <div>
                <span className="text-gray-500">Budget:</span> {formatLeadBudget(selectedLead)}
              </div>
              <div>
                <span className="text-gray-500">Location:</span> {selectedLead.location || '-'}
              </div>
              <div>
                <span className="text-gray-500">Region:</span> {getLeadRegion(selectedLead)}
              </div>
              <div>
                <span className="text-gray-500">Source:</span> {getLeadSource(selectedLead)}
              </div>
              <div>
                <span className="text-gray-500">Visitor ID:</span> {selectedLead.visitor_id || '-'}
              </div>
              <div>
                <span className="text-gray-500">Visitor Session:</span> {selectedLead.visitor_session_id || '-'}
              </div>
              <div>
                <span className="text-gray-500">Landing Page:</span> {selectedLead.landing_page || '-'}
              </div>
              <div>
                <span className="text-gray-500">Submitted Page:</span> {selectedLead.page_url || '-'}
              </div>
              <div>
                <span className="text-gray-500">Referrer:</span> {selectedLead.referrer || '-'}
              </div>
              <div>
                <span className="text-gray-500">Buyer:</span> {selectedLead.buyer_name || '-'}
              </div>
              <div>
                <span className="text-gray-500">Phone:</span> {selectedLead.buyer_phone || '-'}
              </div>
              <div>
                <span className="text-gray-500">Email:</span> {selectedLead.buyer_email || '-'}
              </div>
              <div>
                <span className="text-gray-500">Company:</span> {selectedLead.company_name || '-'}
              </div>
              <div>
                <span className="text-gray-500">Description:</span>
                <p className="mt-1 rounded-md border bg-slate-50 p-3 text-slate-700">
                  {selectedLead.description || selectedLead.message || 'No description provided.'}
                </p>
              </div>
              {selectedLead.sales_note ? (
                <div>
                  <span className="text-gray-500">Sales Note:</span>
                  <p className="mt-1 rounded-md border bg-amber-50 p-3 text-amber-900">
                    {selectedLead.sales_note}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Lead Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lead-budget">Budget (INR)</Label>
              <Input
                id="lead-budget"
                type="number"
                min="0"
                value={priceForm.budget}
                onChange={(e) => setPriceForm((prev) => ({ ...prev, budget: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-note">Sales Note</Label>
              <Textarea
                id="lead-note"
                rows={4}
                value={priceForm.sales_note}
                onChange={(e) => setPriceForm((prev) => ({ ...prev, sales_note: e.target.value }))}
                placeholder="Add context for this price change..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePrice} disabled={actionLoadingId === `price:${selectedLead?.id}`}>
              {actionLoadingId === `price:${selectedLead?.id}` ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
