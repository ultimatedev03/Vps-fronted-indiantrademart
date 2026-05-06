/**
 * Shared page for MANAGER and VP.
 * - MANAGER: sees requests at SALES level, forwards to VP
 * - VP: sees requests at MANAGER level, forwards to ADMIN
 *
 * Pass `role="MANAGER"` or `role="VP"` as prop (or detect from auth context).
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, ArrowUpRight } from 'lucide-react';
import { salesApi } from '@/modules/employee/services/salesApi';

const statusBadge = (status) => {
  if (status === 'RESOLVED') return 'bg-green-50 border border-green-200 text-green-700';
  if (status === 'REJECTED') return 'bg-red-50 border border-red-200 text-red-700';
  if (status === 'FORWARDED') return 'bg-blue-50 border border-blue-200 text-blue-700';
  return 'bg-amber-50 border border-amber-200 text-amber-700';
};

export default function SubscriptionRequests({ role: propRole }) {
  const role = String(propRole || '').toUpperCase();
  const isManager = role === 'MANAGER';
  const isVp = role === 'VP';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteModal, setNoteModal] = useState(null); // { id, note }
  const [forwarding, setForwarding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let data;
      if (isManager) {
        data = await salesApi.getManagerExtensionRequests();
      } else if (isVp) {
        data = await salesApi.getVpExtensionRequests();
      } else {
        data = [];
      }
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      toast({ title: 'Load failed', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [role]);

  const handleForward = async () => {
    if (!noteModal) return;
    setForwarding(true);
    try {
      if (isManager) {
        await salesApi.forwardToVp(noteModal.id, noteModal.note);
        toast({ title: 'Forwarded to VP', description: 'Request escalated to VP for review.' });
      } else if (isVp) {
        await salesApi.forwardToAdmin(noteModal.id, noteModal.note);
        toast({ title: 'Forwarded to Admin', description: 'Request escalated to Admin for resolution.' });
      }
      setNoteModal(null);
      load();
    } catch (e) {
      toast({ title: 'Forward failed', description: e?.message, variant: 'destructive' });
    } finally {
      setForwarding(false);
    }
  };

  const forwardLabel = isManager ? 'Forward to VP' : 'Forward to Admin';
  const pageTitle = isManager ? 'Manager: Extension Requests' : 'VP: Extension Requests';
  const pageDesc = isManager
    ? 'Review vendor subscription extension requests from Sales — forward to VP'
    : 'Review escalated extension requests from Manager — forward to Admin';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">{pageDesc}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Pending Review ({requests.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">No pending requests at your level.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Vendor', 'State', 'Days Req.', 'Reason', 'Sales Note', 'Status', 'Submitted By', 'Date', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.vendor_name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.vendor_state || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.extension_days}d</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={r.sales_note}>
                      {r.sales_note || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.created_by_email}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(r.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => setNoteModal({ id: r.id, note: '', vendor_name: r.vendor_name })}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                        {forwardLabel}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Note modal for forwarding */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              {forwardLabel} — {noteModal.vendor_name}
            </h3>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {isManager ? 'Manager Note' : 'VP Note'} (optional)
              </label>
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                placeholder="Add context for the next reviewer..."
                value={noteModal.note}
                onChange={(e) => setNoteModal((m) => ({ ...m, note: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleForward} disabled={forwarding}>
                {forwarding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {forwardLabel}
              </Button>
              <Button variant="outline" onClick={() => setNoteModal(null)} disabled={forwarding}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
