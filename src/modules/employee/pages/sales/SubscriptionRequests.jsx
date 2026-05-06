import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Plus, Loader2, RefreshCw, Search, X, Building2 } from 'lucide-react';
import { salesApi } from '@/modules/employee/services/salesApi';

// ── helpers ──────────────────────────────────────────────────────────────────

const defaultForm = () => ({
  vendor_id: '',
  vendor_name: '',
  vendor_state: '',
  vendor_city: '',
  reason: '',
  extension_days: '',
  sales_note: '',
});

const statusBadge = (status) => {
  if (status === 'RESOLVED') return 'bg-green-50 border border-green-200 text-green-700';
  if (status === 'REJECTED')  return 'bg-red-50 border border-red-200 text-red-700';
  if (status === 'FORWARDED') return 'bg-blue-50 border border-blue-200 text-blue-700';
  return 'bg-amber-50 border border-amber-200 text-amber-700'; // OPEN
};

const levelLabel = (level) => {
  if (level === 'SALES')   return 'Awaiting Manager';
  if (level === 'MANAGER') return 'With Manager → VP';
  if (level === 'VP')      return 'With VP → Admin';
  if (level === 'ADMIN')   return 'With Admin';
  return level || '—';
};

// ── Vendor Search Dropdown ────────────────────────────────────────────────────

function VendorSearchInput({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const data = await salesApi.searchVendors(q);
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (vendor) => {
    onSelect(vendor);
    setQuery(vendor.company_name);
    setOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect(null);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Search vendor by company name..."
          className="w-full border border-gray-200 rounded-md pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {searching ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">No vendors found</div>
          ) : (
            results.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelect(v)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-start gap-3 border-b border-gray-50 last:border-0"
              >
                <Building2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{v.company_name}</p>
                  <p className="text-xs text-gray-500">{[v.city, v.state].filter(Boolean).join(', ') || 'Location not set'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SubscriptionRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await salesApi.getMyExtensionRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      toast({ title: 'Load failed', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleVendorSelect = (vendor) => {
    if (!vendor) {
      setSelectedVendor(null);
      setForm((f) => ({ ...f, vendor_id: '', vendor_name: '', vendor_state: '', vendor_city: '' }));
      return;
    }
    setSelectedVendor(vendor);
    setForm((f) => ({
      ...f,
      vendor_id: vendor.id,
      vendor_name: vendor.company_name,
      vendor_state: vendor.state || '',
      vendor_city: vendor.city || '',
    }));
  };

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    const days = parseInt(form.extension_days, 10);
    if (!form.vendor_id)    return toast({ title: 'Please select a vendor', variant: 'destructive' });
    if (!form.reason.trim()) return toast({ title: 'Reason is required', variant: 'destructive' });
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return toast({ title: 'Extension days must be between 1 and 365', variant: 'destructive' });
    }

    setSubmitting(true);
    try {
      await salesApi.createExtensionRequest({
        vendor_id:      form.vendor_id,
        vendor_name:    form.vendor_name,
        vendor_state:   form.vendor_state,
        reason:         form.reason.trim(),
        extension_days: days,
        sales_note:     form.sales_note.trim() || undefined,
      });
      toast({ title: 'Request submitted', description: 'Sent to Manager for review.' });
      setForm(defaultForm());
      setSelectedVendor(null);
      setShowForm(false);
      load();
    } catch (e) {
      toast({ title: 'Submit failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setForm(defaultForm());
    setSelectedVendor(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Extension Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Request subscription extensions for vendors — escalates Manager → VP → Admin
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-gray-800">New Extension Request</h2>

          {/* Vendor search */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Select Vendor <span className="text-red-500">*</span>
            </label>
            <VendorSearchInput onSelect={handleVendorSelect} />
          </div>

          {/* Auto-filled vendor info */}
          {selectedVendor && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-3">
              <Building2 className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{selectedVendor.company_name}</p>
                <p className="text-gray-500">
                  {[selectedVendor.city, selectedVendor.state].filter(Boolean).join(', ') || 'Location not available'}
                </p>
                {selectedVendor.email && <p className="text-gray-400 text-xs mt-0.5">{selectedVendor.email}</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Extension Days <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={1}
                max={365}
                placeholder="e.g. 30"
                value={form.extension_days}
                onChange={(e) => handleChange('extension_days', e.target.value)}
              />
              <p className="text-xs text-gray-400">How many extra days does the vendor need?</p>
            </div>

            {/* Show auto-filled state as readonly */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Vendor State</label>
              <Input
                value={form.vendor_state}
                readOnly
                placeholder="Auto-filled from vendor profile"
                className="bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                placeholder="Why does this vendor need a subscription extension? (e.g. low ROI, technical issues, market conditions)"
                value={form.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Additional Note for Manager (optional)</label>
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                placeholder="Any extra context you want the manager to know"
                value={form.sales_note}
                onChange={(e) => handleChange('sales_note', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button onClick={handleSubmit} disabled={submitting || !selectedVendor}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Requests table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">My Requests ({requests.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">No extension requests yet. Click "New Request" to raise one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Vendor', 'State', 'Days Req.', 'Reason', 'Status', 'Where it is', 'Days Granted', 'Raised On'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.vendor_name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.vendor_state || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{r.extension_days}d</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{levelLabel(r.current_level)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.extension_granted_days ? (
                        <span className="text-green-700 font-medium">{r.extension_granted_days}d</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(r.created_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
