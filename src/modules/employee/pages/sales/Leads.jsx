import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

const getStatusBadgeClass = (status) => {
  const value = String(status || 'AVAILABLE').trim().toUpperCase();
  if (['AVAILABLE', 'OPEN'].includes(value)) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (['SENT_TO_VENDOR', 'IN_PROGRESS'].includes(value)) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (['SOLD', 'CLOSED', 'CONVERTED'].includes(value)) return 'bg-green-100 text-green-800 border-green-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
};

const Leads = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [priceForm, setPriceForm] = useState({ budget: '', sales_note: '' });
  const [actionLoadingId, setActionLoadingId] = useState('');

  const loadLeads = async () => {
    try {
      setLoading(true);
      const data = await salesApi.getAllLeads();
      setLeads(Array.isArray(data) ? data : []);
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
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    if (!query) return leads;

    return (leads || []).filter((lead) =>
      [
        lead?.id,
        getLeadTitle(lead),
        getLeadCategory(lead),
        lead?.status,
        lead?.description,
        lead?.buyer_name,
        lead?.buyer_email,
        lead?.location,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [leads, searchTerm]);

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold text-neutral-800">Sales CRM: Lead Management</h2>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
          <Input
            placeholder="Search leads..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead ID</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posted Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-neutral-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-neutral-500">
                    No leads found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.id}</TableCell>
                    <TableCell>{getLeadTitle(lead)}</TableCell>
                    <TableCell>{getLeadCategory(lead)}</TableCell>
                    <TableCell>{formatLeadBudget(lead)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeClass(lead.status)}>
                        {String(lead?.status || 'AVAILABLE').replaceAll('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(lead?.created_at || lead?.date)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" title="View Details" onClick={() => openDetails(lead)}>
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Send to Vendor"
                          onClick={() => handleSendToVendor(lead)}
                          disabled={actionLoadingId === `send:${lead.id}`}
                        >
                          {actionLoadingId === `send:${lead.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                          ) : (
                            <Send className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button size="icon" variant="ghost" title="Change Price" onClick={() => openPriceDialog(lead)}>
                          <DollarSign className="h-4 w-4 text-amber-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
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
                <span className="text-gray-500">Buyer:</span> {selectedLead.buyer_name || selectedLead.buyer_email || '-'}
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
