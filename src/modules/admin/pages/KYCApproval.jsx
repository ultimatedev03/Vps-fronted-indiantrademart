import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { Search, CheckCircle, XCircle, Eye, FileText, Loader2, ShieldAlert, Building2, Mail, Phone, Filter, Download } from 'lucide-react';
import { filterRecordsBySearch } from '@/modules/admin/lib/search';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KYC_VENDOR_BATCH_SIZE = 5000;
const MIN_VALID_JOIN_DATE_MS = Date.UTC(2000, 0, 1);

const looksLikePdf = (v = '') => String(v || '').toLowerCase().includes('.pdf');

const prettyLabel = (t = '') => {
  const x = String(t || '').replaceAll('_', ' ').trim();
  return x ? x.toUpperCase() : 'DOCUMENT';
};

const normalizeEpochMs = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric < 1e12 ? numeric * 1000 : numeric;
};

const parseJoinedDateValue = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    const time = value.getTime();
    if (Number.isNaN(time) || time < MIN_VALID_JOIN_DATE_MS) return null;
    return value;
  }

  if (typeof value === 'number') {
    const epochMs = normalizeEpochMs(value);
    if (!epochMs) return null;
    return parseJoinedDateValue(new Date(epochMs));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{10,13}$/.test(trimmed)) {
      return parseJoinedDateValue(Number(trimmed));
    }
    return parseJoinedDateValue(new Date(trimmed));
  }

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return parseJoinedDateValue(value.toDate());
    if ('seconds' in value) return parseJoinedDateValue(value.seconds);
    if ('_seconds' in value) return parseJoinedDateValue(value._seconds);
    if ('milliseconds' in value) return parseJoinedDateValue(value.milliseconds);
    if ('ms' in value) return parseJoinedDateValue(value.ms);
    if ('iso' in value) return parseJoinedDateValue(value.iso);
  }

  return null;
};

const resolveVendorJoinedOn = (vendor = null) => {
  const parsed =
    parseJoinedDateValue(vendor?.joined_on) ||
    parseJoinedDateValue(vendor?.joined_at) ||
    parseJoinedDateValue(vendor?.registration_date) ||
    parseJoinedDateValue(vendor?.registered_at) ||
    parseJoinedDateValue(vendor?.created_at);

  return parsed ? parsed.toISOString() : null;
};

const formatJoinedDate = (value) => {
  const date = parseJoinedDateValue(value);
  if (!date) return '-';
  return date.toLocaleDateString('en-IN');
};

async function downloadViaFetch(url, filename = 'document') {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// ✅ Netlify vs Local API base
const isLocalHost = () => {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
};

// ✅ safest: allow override by env, else auto
const getKycBase = () => {
  const override = import.meta.env.VITE_KYC_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return isLocalHost() ? '/api/kyc' : '/.netlify/functions/kyc';
};

const getAdminBase = () => {
  const override = import.meta.env.VITE_ADMIN_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return isLocalHost() ? '/api/admin' : '/.netlify/functions/admin';
};

// ✅ Prevent "Unexpected token <" by validating response content-type
async function safeReadJson(res) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return await res.json();
  }
  const text = await res.text();
  throw new Error(`API returned non-JSON (${res.status}). Got: ${text.slice(0, 80)}...`);
}

const normalizeKycStatus = (status = '') => {
  const normalized = String(status || '').trim().toUpperCase();
  return normalized === 'VERIFIED' ? 'APPROVED' : normalized || 'PENDING';
};

const isPendingKycStatus = (status = '') => ['PENDING', 'SUBMITTED'].includes(normalizeKycStatus(status));
const isApprovedKycStatus = (status = '') => normalizeKycStatus(status) === 'APPROVED';
const isRejectedKycStatus = (status = '') => normalizeKycStatus(status) === 'REJECTED';

const KYCApproval = () => {
  const [vendors, setVendors] = useState([]);
  const [totalVendors, setTotalVendors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorDocs, setVendorDocs] = useState([]);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [imgErrors, setImgErrors] = useState({});

  const KYC_API_BASE = getKycBase();
  const ADMIN_API_BASE = getAdminBase();

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const collectedVendors = [];
      let expectedTotal = 0;
      let offset = 0;
      const statusMap = { pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED', submitted: 'SUBMITTED' };
      const normalizedStatus = statusMap[filterStatus] || null;

      while (true) {
        const params = new URLSearchParams({
          limit: String(KYC_VENDOR_BATCH_SIZE),
          offset: String(offset),
        });
        if (normalizedStatus) {
          params.set('kyc', normalizedStatus);
        }

        const response = await fetchWithCsrf(`${ADMIN_API_BASE}/vendors?${params.toString()}`);
        const payload = await safeReadJson(response);
        if (!payload?.success) {
          throw new Error(payload?.error || 'Failed to load vendors');
        }

        const batch = (Array.isArray(payload.vendors) ? payload.vendors : []).map((vendor) => ({
          ...vendor,
          joined_on: resolveVendorJoinedOn(vendor),
          product_count:
            Number(vendor?.product_count ?? vendor?.products?.[0]?.count ?? vendor?.products_count ?? 0) || 0,
        }));
        if (offset === 0) {
          expectedTotal = Number(payload.total) || batch.length;
        }

        collectedVendors.push(...batch);

        if (batch.length < KYC_VENDOR_BATCH_SIZE || collectedVendors.length >= expectedTotal) {
          break;
        }

        offset += KYC_VENDOR_BATCH_SIZE;
      }

      setVendors(collectedVendors);
      setTotalVendors(expectedTotal || collectedVendors.length);
    } catch (error) {
      console.error(error);
      setVendors([]);
      setTotalVendors(0);
      toast({ title: 'Error', description: 'Failed to load vendors', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [ADMIN_API_BASE, filterStatus, toast]);

  const filteredVendors = useMemo(() => {
    if (!String(searchTerm || '').trim()) return vendors;
    return filterRecordsBySearch(vendors, searchTerm, {
      exactIdKeys: ['id', 'vendor_id'],
      exactEmailKeys: ['email'],
      broadKeys: ['id', 'vendor_id', 'company_name', 'owner_name', 'email', 'phone'],
    });
  }, [searchTerm, vendors]);

  const hasSearchTerm = Boolean(String(searchTerm || '').trim());
  const summaryCount = hasSearchTerm ? filteredVendors.length : (totalVendors || vendors.length);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-kyc-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => {
        void loadVendors();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_documents' }, () => {
        void loadVendors();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_documents' }, () => {
        void loadVendors();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadVendors]);

  const handleSearch = (e) => {
    e.preventDefault();
  };

  const handleApprove = async (vendor) => {
    if (!vendor?.id) {
      toast({ title: 'Error', description: 'Invalid vendor selected', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`${KYC_API_BASE}/vendors/${vendor.id}/approve`, { method: 'POST' });
      const json = await safeReadJson(res);
      if (!json?.success) throw new Error(json?.details || json?.error || 'Approve failed');

      toast({ title: 'Success', description: 'Vendor KYC Approved' });
      loadVendors();
      setShowDocsModal(false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectRemarks.trim()) {
      toast({ title: 'Required', description: 'Please enter rejection remarks', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`${KYC_API_BASE}/vendors/${selectedVendor.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: rejectRemarks }),
      });
      const json = await safeReadJson(res);
      if (!json?.success) throw new Error(json?.details || json?.error || 'Reject failed');

      toast({ title: 'Success', description: 'Vendor KYC Rejected' });
      loadVendors();
      setShowRejectModal(false);
      setShowDocsModal(false);
      setRejectRemarks('');
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const openDocs = async (vendor) => {
    setSelectedVendor(vendor);
    setShowDocsModal(true);
    setVendorDocs([]);
    setImgErrors({});
    setDocsLoading(true);

    try {
      const res = await fetch(`${KYC_API_BASE}/vendors/${vendor.id}/documents`);
      const json = await safeReadJson(res);
      if (!json?.success) throw new Error(json?.details || json?.error || 'Could not load documents');

      if (json?.vendor) {
        setSelectedVendor((prev) => ({ ...(prev || {}), ...(json.vendor || {}) }));
      }

      const normalized = (json.documents || []).map((d) => ({
        ...d,
        url: d.url || d.document_url || d.file_path || d.documentUrl || d.public_url || '',
        document_type: d.document_type || d.type || 'document',
        status: d.status || d.verification_status || 'PENDING',
      }));

      setVendorDocs(normalized);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Could not load documents', variant: 'destructive' });
      setVendorDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const getKycBadgeStyle = (status) => {
    const styles = {
      APPROVED: 'bg-green-100 text-green-800',
      VERIFIED: 'bg-green-100 text-green-800',
      SUBMITTED: 'bg-yellow-100 text-yellow-800',
      PENDING: 'bg-gray-100 text-gray-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const openReject = (vendor) => {
    setSelectedVendor(vendor);
    setShowRejectModal(true);
  };

  const canApproveKyc = (vendor) => isPendingKycStatus(vendor?.kyc_status) || isRejectedKycStatus(vendor?.kyc_status);
  const canRejectKyc = (vendor) => isPendingKycStatus(vendor?.kyc_status) || isApprovedKycStatus(vendor?.kyc_status);
  const getRejectLabel = (vendor) => (isApprovedKycStatus(vendor?.kyc_status) ? 'Re-KYC' : 'Reject KYC');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Vendor Management</h1>
          <p className="text-gray-500">View and manage all vendors and KYC approvals</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {summaryCount} {hasSearchTerm ? 'Matching Vendors' : 'Total Vendors'}
        </Badge>
      </div>

      <div className="flex flex-col md:flex-row gap-4 p-4 bg-white rounded-lg border">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input className="pl-9" placeholder="Search by vendor ID, internal ID, company, phone, or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </form>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner / Contact</TableHead>
                <TableHead>KYC Status</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="animate-spin mx-auto h-6 w-6 text-gray-400" />
                  </TableCell>
                </TableRow>
              ) : filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    <Building2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    No vendors found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{vendor.company_name}</p>
                          <p className="text-xs text-gray-500">{vendor.vendor_id || vendor.business_type || 'Business'}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm font-medium">{vendor.owner_name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {vendor.email}
                      </div>
                      {vendor.phone && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {vendor.phone}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge className={getKycBadgeStyle(vendor.kyc_status)}>
                        {normalizeKycStatus(vendor.kyc_status)}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm font-medium text-gray-600">{vendor.product_count || 0}</span>
                    </TableCell>

                    <TableCell className="text-sm text-gray-500">{formatJoinedDate(vendor.joined_on || vendor.created_at)}</TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDocs(vendor)}>
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>

                        {canApproveKyc(vendor) ? (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleApprove(vendor)}
                            disabled={processing}
                            title={isRejectedKycStatus(vendor?.kyc_status) ? 'Re-approve KYC' : 'Approve KYC'}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        ) : null}
                        {canRejectKyc(vendor) ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openReject(vendor)}
                            disabled={processing}
                            title={getRejectLabel(vendor)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDocsModal} onOpenChange={setShowDocsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KYC Documents: {selectedVendor?.company_name}</DialogTitle>
            <DialogDescription>Review submitted documents before approval.</DialogDescription>
          </DialogHeader>

          {selectedVendor && (
            <div className="rounded-lg border bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b bg-gray-50">
                <div>
                  <div className="font-semibold text-sm text-neutral-800">
                    {selectedVendor.company_name}
                    {selectedVendor.vendor_id ? <span className="ml-2 text-xs text-gray-500">({selectedVendor.vendor_id})</span> : null}
                  </div>
                  <div className="text-xs text-gray-500">Owner: {selectedVendor.owner_name || '—'}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={getKycBadgeStyle(selectedVendor.kyc_status)}>
                    {normalizeKycStatus(selectedVendor.kyc_status)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {vendorDocs?.length || 0} Docs
                  </Badge>
                </div>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="break-all">{selectedVendor.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{selectedVendor.phone || '—'}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Business: <span className="text-gray-700">{selectedVendor.business_type || '—'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-gray-500">
                    GST: <span className="text-gray-700">{selectedVendor.gst_number || '—'}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    PAN: <span className="text-gray-700">{selectedVendor.pan_number || '—'}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Address: <span className="text-gray-700">{selectedVendor.registered_address || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {docsLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-gray-500" />
            </div>
          ) : vendorDocs.length === 0 ? (
            <div className="py-10 text-center text-gray-500">No documents uploaded.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {vendorDocs.map((doc, idx) => {
                const url = (doc?.url || '').trim();
                const isPdf = doc?.is_pdf || looksLikePdf(url);

                return (
                  <div key={idx} className="border rounded-lg overflow-hidden bg-white">
                    <div className="p-3 flex justify-between items-start border-b bg-gray-50">
                      <div className="space-y-1">
                        <span className="font-medium text-sm">{prettyLabel(doc.document_type)}</span>
                        {doc.status ? <div className="text-[11px] text-gray-500">Status: {String(doc.status).toUpperCase()}</div> : null}
                      </div>
                      <span className="text-xs text-gray-500">{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}</span>
                    </div>

                    <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden relative">
                      {!url ? (
                        <div className="text-xs text-gray-500">File URL missing</div>
                      ) : isPdf || imgErrors[idx] ? (
                        <FileText className="w-12 h-12 text-gray-400" />
                      ) : (
                        <img
                          src={url}
                          alt="KYC Document"
                          className="object-cover w-full h-full"
                          onError={() => setImgErrors((p) => ({ ...p, [idx]: true }))}
                        />
                      )}
                    </div>

                    <div className="p-3 flex justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={!url} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
                        <Eye className="h-4 w-4 mr-2" /> View
                      </Button>

                      <Button variant="outline" size="sm" disabled={!url} onClick={() => downloadViaFetch(url, `${doc.document_type || 'document'}`)}>
                        <Download className="h-4 w-4 mr-2" /> Download
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {canRejectKyc(selectedVendor) ? (
              <Button
                variant="destructive"
                onClick={() => {
                  setShowDocsModal(false);
                  openReject(selectedVendor);
                }}
                disabled={processing}
              >
                {getRejectLabel(selectedVendor)}
              </Button>
            ) : null}
            {canApproveKyc(selectedVendor) ? (
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(selectedVendor)} disabled={processing}>
                {isRejectedKycStatus(selectedVendor?.kyc_status) ? 'Re-approve KYC' : 'Approve KYC'}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setShowDocsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Reject KYC
            </DialogTitle>
            <DialogDescription>Please provide a reason for rejection.</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea placeholder="e.g. Document blurry, Name mismatch..." value={rejectRemarks} onChange={(e) => setRejectRemarks(e.target.value)} rows={4} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? <Loader2 className="animate-spin mr-2" /> : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KYCApproval;
