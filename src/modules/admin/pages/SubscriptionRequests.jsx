import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

const isLocalHost = () => {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
};

const getAdminBase = () => {
  const override = import.meta.env.VITE_ADMIN_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return isLocalHost() ? '/api/admin' : '/.netlify/functions/admin';
};

const fmt = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusBadge = (status) => {
  if (status === 'RESOLVED') return 'bg-green-50 border border-green-200 text-green-700';
  if (status === 'REJECTED') return 'bg-red-50 border border-red-200 text-red-700';
  if (status === 'FORWARDED') return 'bg-blue-50 border border-blue-200 text-blue-700';
  return 'bg-amber-50 border border-amber-200 text-amber-700';
};

export default function SubscriptionRequests() {
  const ADMIN_API_BASE = getAdminBase();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolveModal, setResolveModal] = useState(null); // { id, vendor_name, extension_days }
  const [rejectModal, setRejectModal] = useState(null);   // { id, vendor_name }
  const [form, setForm] = useState({ extension_granted_days: '', admin_note: '' });
  const [rejectNote, setRejectNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/subscription-requests/pending`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');
      setRequests(json.requests || []);
    } catch (e) {
      toast({ title: 'Load failed', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async () => {
    const days = parseInt(form.extension_granted_days, 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return toast({ title: 'Enter days between 1 and 365', variant: 'destructive' });
    }
    setResolving(true);
    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/subscription-requests/${resolveModal.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          decision: 'APPROVE',
          extension_granted_days: days,
          admin_note: form.admin_note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      toast({ title: 'Subscription extended', description: `Extended by ${days} days. New end: ${fmt(json.new_end_date)}` });
      setResolveModal(null);
      setForm({ extension_granted_days: '', admin_note: '' });
      load();
    } catch (e) {
      toast({ title: 'Approval failed', description: e?.message, variant: 'destructive' });
    } finally {
      setResolving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      return toast({ title: 'Reason required for rejection', variant: 'destructive' });
    }
    setResolving(true);
    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/subscription-requests/${rejectModal.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'REJECT', admin_note: rejectNote.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      toast({ title: 'Request rejected' });
      setRejectModal(null);
      setRejectNote('');
      load();
    } catch (e) {
      toast({ title: 'Rejection failed', description: e?.message, variant: 'destructive' });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Extension Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vendor subscription requests escalated through Sales → Manager → VP — only vendors in your zone are shown.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary card */}
      {requests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">
            {requests.length}
          </div>
          <span className="text-sm text-amber-800 font-medium">
            {requests.length} vendor subscription extension {requests.length === 1 ? 'request' : 'requests'} pending your decision
          </span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">No pending subscription extension requests in your zone.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Vendor', 'State', 'Days Req.', 'Reason', 'Sales Note', 'Manager Note', 'VP Note', 'By', 'Date', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.vendor_name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.vendor_state || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{r.extension_days}d</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={r.sales_note}>{r.sales_note || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={r.manager_note}>{r.manager_note || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={r.vp_note}>{r.vp_note || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{r.created_by_email}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmt(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white h-7 px-3 text-xs"
                          onClick={() => setResolveModal({ id: r.id, vendor_name: r.vendor_name, extension_days: r.extension_days })}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-3 text-xs"
                          onClick={() => setRejectModal({ id: r.id, vendor_name: r.vendor_name })}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              Approve Extension — {resolveModal.vendor_name}
            </h3>
            <p className="text-sm text-gray-500">
              Requested: <span className="font-medium text-gray-700">{resolveModal.extension_days} days</span>
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Days to Grant *</label>
              <input
                type="number"
                min={1}
                max={365}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder={`Requested: ${resolveModal.extension_days}`}
                value={form.extension_granted_days}
                onChange={(e) => setForm((f) => ({ ...f, extension_granted_days: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Admin Note (optional)</label>
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                rows={2}
                placeholder="Note for audit trail"
                value={form.admin_note}
                onChange={(e) => setForm((f) => ({ ...f, admin_note: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={resolving}>
                {resolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Approve & Extend
              </Button>
              <Button variant="outline" onClick={() => { setResolveModal(null); setForm({ extension_granted_days: '', admin_note: '' }); }} disabled={resolving}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              Reject Request — {rejectModal.vendor_name}
            </h3>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Reason for Rejection *</label>
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                rows={3}
                placeholder="Explain why the request is being rejected"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="destructive" onClick={handleReject} disabled={resolving}>
                {resolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reject Request
              </Button>
              <Button variant="outline" onClick={() => { setRejectModal(null); setRejectNote(''); }} disabled={resolving}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
