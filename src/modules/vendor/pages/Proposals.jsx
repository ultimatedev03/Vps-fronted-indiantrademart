import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { quotationApi } from '@/modules/vendor/services/quotationApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Calendar, Clock3, Loader2, Plus, Trash2, User } from 'lucide-react';
import { useSubdomain } from '@/contexts/SubdomainContext';
import { phoneUtils } from '@/shared/utils/phoneUtils';

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatMoney = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(num);
};

const getServiceName = (proposal = {}) =>
  proposal?.product_name ||
  proposal?.service_name ||
  proposal?.title ||
  'Untitled service';

const getCounterpartyName = (proposal = {}) =>
  proposal?.buyers?.full_name ||
  proposal?.buyer_name ||
  proposal?.buyers?.company_name ||
  proposal?.buyer_email ||
  'Customer';

const getCounterpartyEmail = (proposal = {}) =>
  proposal?.buyers?.email || proposal?.buyer_email || null;

const getCounterpartyPhone = (proposal = {}) =>
  proposal?.buyers?.phone || proposal?.buyer_phone || null;

const getCounterpartyCompany = (proposal = {}) =>
  proposal?.buyers?.company_name || proposal?.company_name || null;

const isContactUnlocked = (proposal = {}) => {
  if (typeof proposal?.is_contact_unlocked === 'boolean') return proposal.is_contact_unlocked;
  if (typeof proposal?.details_unlocked === 'boolean') return proposal.details_unlocked;
  if (typeof proposal?.lead_unlocked === 'boolean') return proposal.lead_unlocked;
  return Boolean(
    proposal?.lead_purchase_id ||
      proposal?.is_purchased === true ||
      String(proposal?.lead_status || '').toUpperCase() === 'PURCHASED'
  );
};

const maskText = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 1) return '*';
      return `${part.slice(0, 1)}${'*'.repeat(Math.max(part.length - 1, 2))}`;
    })
    .join(' ');
};

const maskEmail = (value) => {
  const email = String(value || '').trim();
  if (!email || !email.includes('@')) return '';
  const [localPartRaw, domainRaw] = email.split('@');
  const localPart = String(localPartRaw || '');
  const domain = String(domainRaw || '');
  const domainParts = domain.split('.');
  const domainName = String(domainParts[0] || '');
  const domainSuffix = domainParts.length > 1 ? `.${domainParts.slice(1).join('.')}` : '';

  const maskedLocal =
    localPart.length <= 2
      ? `${localPart.slice(0, 1)}*`
      : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 3))}`;
  const maskedDomain =
    domainName.length <= 2
      ? `${domainName.slice(0, 1)}*`
      : `${domainName.slice(0, 2)}${'*'.repeat(Math.max(domainName.length - 2, 3))}`;
  return `${maskedLocal}@${maskedDomain}${domainSuffix}`;
};

const maskPhone = (value) => phoneUtils.maskPhone(value);

const Proposals = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvePath } = useSubdomain();
  const sendQuotationPath = resolvePath('proposals/send', 'vendor');
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    return tab === 'sent' ? 'sent' : 'received';
  });
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    const nextTab = tab === 'sent' ? 'sent' : 'received';
    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [location.search]);

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      let data = await vendorApi.proposals.list(activeTab);

      // Keep quotation endpoint as fallback for older deployments.
      if (activeTab === 'sent' && (!Array.isArray(data) || data.length === 0)) {
        try {
          const fallbackRows = await quotationApi.getSentQuotations();
          if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
            data = fallbackRows;
          }
        } catch {
          // no-op fallback
        }
      }

      setProposals(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load proposals:', error);
      setProposals([]);
      toast({
        title: 'Unable to load proposals',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const openDetail = async (id) => {
    try {
      const data = await vendorApi.proposals.get(id);
      setSelected(data);
      setDetailOpen(true);
    } catch (error) {
      console.error('Failed to load proposal details:', error);
      toast({
        title: 'Unable to open details',
        description: error?.message || 'Please refresh and try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;

    const target = proposals.find((row) => row?.id === id) || selected || {};
    const serviceName = getServiceName(target);
    const ok = window.confirm(`Delete quotation for "${serviceName}"? This action cannot be undone.`);
    if (!ok) return;

    setDeletingId(String(id));
    try {
      await vendorApi.proposals.delete(id);
      setProposals((prev) => prev.filter((row) => row?.id !== id));
      if (String(selected?.id || '') === String(id)) {
        setDetailOpen(false);
        setSelected(null);
      }
      toast({
        title: 'Quotation deleted',
        description: 'The quotation has been removed successfully.',
      });
    } catch (error) {
      console.error('Failed to delete quotation:', error);
      toast({
        title: 'Delete failed',
        description: error?.message || 'Unable to delete this quotation.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId('');
    }
  };

  const selectedDirection = useMemo(() => {
    const hasBuyerEmail = Boolean(String(selected?.buyer_email || '').trim());
    return hasBuyerEmail ? 'sent' : 'received';
  }, [selected]);

  const selectedCounterpartyName = getCounterpartyName(selected || {});
  const selectedCounterpartyCompany = getCounterpartyCompany(selected || {});
  const selectedCounterpartyEmail = getCounterpartyEmail(selected || {});
  const selectedCounterpartyPhone = getCounterpartyPhone(selected || {});
  const selectedDetailsUnlocked = isContactUnlocked(selected || {});
  const selectedAmount = formatMoney(selected?.quotation_amount || selected?.budget);
  const selectedCreatedAt = selected?.created_at || selected?.updated_at || null;
  const selectedService = getServiceName(selected || {});
  const selectedNameValue = selectedDetailsUnlocked
    ? selectedCounterpartyName || 'Customer'
    : maskText(selectedCounterpartyName) || 'Hidden';
  const selectedCompanyValue = selectedDetailsUnlocked
    ? selectedCounterpartyCompany || 'N/A'
    : selectedCounterpartyCompany
      ? maskText(selectedCounterpartyCompany)
      : 'Hidden';
  const selectedEmailValue = selectedDetailsUnlocked
    ? selectedCounterpartyEmail || 'N/A'
    : selectedCounterpartyEmail
      ? maskEmail(selectedCounterpartyEmail)
      : 'Hidden';
  const selectedPhoneValue = selectedDetailsUnlocked
    ? selectedCounterpartyPhone || 'N/A'
    : selectedCounterpartyPhone
      ? maskPhone(selectedCounterpartyPhone)
      : 'Hidden';

  const renderCard = (proposal, type) => {
    const id = String(proposal?.id || '');
    const service = getServiceName(proposal);
    const counterparty = getCounterpartyName(proposal);
    const detailsUnlocked = isContactUnlocked(proposal);
    const counterpartyDisplay = detailsUnlocked ? counterparty : maskText(counterparty) || 'Customer';
    const amount = formatMoney(proposal?.quotation_amount || proposal?.budget);
    const quantity = proposal?.quantity ? String(proposal.quantity) : null;
    const createdAt = proposal?.created_at || proposal?.updated_at || null;
    const actionDateLabel = type === 'sent' ? 'Sent at' : 'Received at';
    const subtitleText =
      type === 'sent'
        ? `Sent to ${counterpartyDisplay}`
        : `Requested by ${counterpartyDisplay}`;

    return (
      <Card key={id} className="border-neutral-200 hover:shadow-md transition-shadow">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-[#003D82]">{service}</h3>
                <Badge variant="secondary">{proposal?.status || (type === 'sent' ? 'SENT' : 'PENDING')}</Badge>
                <Badge variant="outline">{detailsUnlocked ? 'Details unlocked' : 'Details masked'}</Badge>
              </div>

              <p className="text-sm text-neutral-600">{subtitleText}</p>

              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-neutral-700">
                <span className="rounded-md bg-neutral-100 px-2 py-1">Service: {service}</span>
                {amount ? <span className="rounded-md bg-neutral-100 px-2 py-1">Amount: INR {amount}</span> : null}
                {quantity ? <span className="rounded-md bg-neutral-100 px-2 py-1">Qty: {quantity}</span> : null}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 md:text-sm">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{actionDateLabel}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>{formatDateTime(createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button onClick={() => openDetail(proposal?.id)}>View Details</Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleDelete(proposal?.id)}
                disabled={deletingId === id}
              >
                {deletingId === id ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Proposals</h1>
          <p className="text-gray-500">Manage your sent and received quotations</p>
        </div>
        <Button className="bg-[#003D82]" onClick={() => navigate(sendQuotationPath)}>
          <Plus className="mr-2 h-4 w-4" /> Send Quotation
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[420px]">
          <TabsTrigger value="received">Received Requests</TabsTrigger>
          <TabsTrigger value="sent">Sent Quotations</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4 mt-6">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center p-8 border rounded bg-white text-gray-500">
              No received requests found.
            </div>
          ) : (
            proposals.map((proposal) => renderCard(proposal, 'received'))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4 mt-6">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center p-8 border rounded bg-white text-gray-500">
              No sent quotations yet. Use "Send Quotation" to share your offer.
            </div>
          ) : (
            proposals.map((proposal) => renderCard(proposal, 'sent'))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedService}</DialogTitle>
            <DialogDescription>
              {selectedDirection === 'sent' ? 'Sent on' : 'Received on'} {formatDateTime(selectedCreatedAt)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border p-3 bg-neutral-50">
                <div className="flex items-center gap-2 text-neutral-700">
                  <User className="h-4 w-4" />
                  <span className="font-semibold text-neutral-900">{selectedNameValue}</span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-neutral-600">
                  <div>Company: {selectedCompanyValue}</div>
                  <div>Email: {selectedEmailValue}</div>
                  <div>Contact: {selectedPhoneValue}</div>
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-neutral-50 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{selected?.status || 'PENDING'}</Badge>
                  {selectedAmount ? <Badge variant="outline">INR {selectedAmount}</Badge> : null}
                </div>
                <div className="text-xs text-neutral-600">Service: {selectedService}</div>
                {selected?.quantity ? (
                  <div className="text-xs text-neutral-600">Quantity: {selected.quantity}</div>
                ) : null}
                {selected?.required_by_date ? (
                  <div className="text-xs text-neutral-600">
                    Required by: {formatDateTime(selected.required_by_date)}
                  </div>
                ) : null}
                <div className={`text-xs ${selectedDetailsUnlocked ? 'text-green-700' : 'text-amber-700'}`}>
                  {selectedDetailsUnlocked
                    ? 'Contact details unlocked after lead purchase.'
                    : 'Contact details are masked until lead purchase.'}
                </div>
              </div>
            </div>

            {selected?.description ? (
              <div className="border rounded-lg p-3 text-neutral-700 bg-neutral-50">
                {selected.description}
              </div>
            ) : (
              <div className="border rounded-lg p-3 text-neutral-500 bg-neutral-50">
                No additional notes shared.
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              {selectedDetailsUnlocked && selectedCounterpartyEmail ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    const subject = encodeURIComponent(`Regarding quotation: ${selectedService}`);
                    const body = encodeURIComponent(selected?.description || '');
                    window.location.href = `mailto:${selectedCounterpartyEmail}?subject=${subject}&body=${body}`;
                  }}
                >
                  Share via Email
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(selected?.id)}
                disabled={deletingId === String(selected?.id || '')}
              >
                {deletingId === String(selected?.id || '') ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Proposals;
