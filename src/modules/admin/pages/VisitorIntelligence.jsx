import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WebsiteVisitorActivityCard from '@/shared/components/WebsiteVisitorActivityCard';
import { adminApi } from '@/modules/admin/services/adminApi';

const DAY_OPTIONS = [7, 15, 30];
const LIMIT_OPTIONS = [25, 50, 100];

const emptyActivity = {
  stats: {},
  events: [],
};

const VisitorIntelligence = () => {
  const [days, setDays] = useState(7);
  const [limit, setLimit] = useState(50);
  const [activity, setActivity] = useState(emptyActivity);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getVisitorActivity({ days, limit });
      setActivity({
        stats: data?.stats || {},
        events: Array.isArray(data?.events) ? data.events : [],
      });
    } catch (err) {
      setError(err?.message || 'Unable to load visitor intelligence right now.');
      setActivity(emptyActivity);
    } finally {
      setLoading(false);
    }
  }, [days, limit]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const stats = useMemo(
    () => ({
      ...(activity.stats || {}),
      days,
    }),
    [activity.stats, days]
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-[#003D82]">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Visitor Intelligence</h1>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                Admin
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Website visits, searches, product views, vendor profile views, and captured contact context in one monitoring view.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-slate-200 bg-white px-3 py-1 text-slate-700">
            <Database className="mr-1.5 h-3.5 w-3.5" />
            {activity.events?.length || 0} loaded
          </Badge>

          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {DAY_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  days === value
                    ? 'bg-[#003D82] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {value}d
              </button>
            ))}
          </div>

          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {LIMIT_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLimit(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  limit === value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={loadActivity} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <WebsiteVisitorActivityCard
        events={activity.events || []}
        stats={stats}
        loading={loading}
        onRefresh={loadActivity}
        title="Website Visitor Intelligence"
        description="Visitor searches, product views, vendor profile views, and submitted contact context for admin monitoring."
      />
    </div>
  );
};

export default VisitorIntelligence;
