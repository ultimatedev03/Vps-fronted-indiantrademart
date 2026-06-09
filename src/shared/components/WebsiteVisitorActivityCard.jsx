import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fmtDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const eventTypeLabel = (value = '') =>
  String(value || 'PAGE_VIEW')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const shortVisitorId = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return raw.length > 18 ? `${raw.slice(0, 10)}...${raw.slice(-5)}` : raw;
};

const getActivityTitle = (event) => {
  const type = String(event?.event_type || '').toUpperCase();
  if (type === 'SEARCH') return event?.search_query || event?.entity_name || 'Search';
  if (event?.entity_name) return event.entity_name;
  if (event?.page_title) return event.page_title;
  return eventTypeLabel(type);
};

const getActivityDetail = (event) => {
  const type = String(event?.event_type || '').toUpperCase();
  if (type === 'PRODUCT_VIEW') return 'Product viewed';
  if (type === 'VENDOR_VIEW') return 'Vendor profile viewed';
  if (type === 'CATEGORY_VIEW') return 'Category browsed';
  if (type === 'CITY_VIEW') return 'City page viewed';
  if (type === 'PLAN_VIEW') return 'Pricing page viewed';
  if (type === 'SEARCH') return 'Search activity';
  return 'Page visit';
};

const getContactLine = (event) =>
  [
    event?.visitor_name,
    event?.visitor_email,
    event?.visitor_phone,
    event?.visitor_company,
  ].filter(Boolean).join(' | ');

const WebsiteVisitorActivityCard = ({
  events = [],
  stats = {},
  loading = false,
  onRefresh,
  dark = false,
  technical = false,
  title = 'Website Visitor Activity',
  description = 'Public website visits, searches, product views, and vendor profile views.',
}) => {
  const cardClass = dark ? 'bg-neutral-900 border-neutral-800 text-neutral-200' : 'border-slate-200 shadow-sm';
  const muted = dark ? 'text-neutral-400' : 'text-slate-500';
  const border = dark ? 'border-neutral-800' : 'border-slate-200';
  const headBg = dark ? 'bg-neutral-800' : 'bg-slate-50';

  return (
    <Card className={`rounded-lg ${cardClass}`}>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className={dark ? 'text-white' : 'text-slate-950'}>{title}</CardTitle>
          <p className={`mt-1 text-sm ${muted}`}>{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={dark ? 'border-blue-900 bg-blue-950 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700'}>
            {stats?.total_events || events.length || 0} events
          </Badge>
          <Badge variant="outline" className={dark ? 'border-emerald-900 bg-emerald-950 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
            {stats?.unique_visitors || 0} visitors
          </Badge>
          {onRefresh ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className={dark ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : ''}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Page Views', stats?.page_views || 0],
            ['Searches', stats?.searches || 0],
            ['Product Views', stats?.product_views || 0],
            ['Vendor Views', stats?.vendor_views || 0],
            ['Days', stats?.days || 7],
          ].map(([label, value]) => (
            <div key={label} className={`rounded-lg border p-3 ${dark ? 'border-neutral-800 bg-neutral-950' : 'border-slate-200 bg-slate-50'}`}>
              <p className={`text-xs uppercase tracking-wide ${muted}`}>{label}</p>
              <p className={`mt-1 text-xl font-bold ${dark ? 'text-white' : 'text-slate-950'}`}>{value}</p>
            </div>
          ))}
        </div>

        {events.length === 0 ? (
          <div className={`rounded-lg border border-dashed p-8 text-center text-sm ${muted}`}>
            <Activity className="mx-auto mb-3 h-6 w-6 opacity-60" />
            {loading ? 'Loading visitor activity...' : 'No website visitor activity recorded yet.'}
          </div>
        ) : (
          <div className={`overflow-x-auto rounded-lg border ${border}`}>
            <table className="w-full text-sm">
              <thead className={headBg}>
                <tr className={`border-b text-left text-xs uppercase tracking-wide ${muted} ${border}`}>
                  <th className="py-3 pl-4 pr-3">Activity</th>
                  <th className="py-3 pr-3">Visitor Detail</th>
                  <th className="py-3 pr-3">Page</th>
                  <th className="py-3 pr-3">Source</th>
                  {technical ? <th className="py-3 pr-3">Technical</th> : null}
                  <th className="py-3 pr-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className={`border-b last:border-0 ${border}`}>
                    <td className="py-3 pl-4 pr-3 align-top">
                      <div className={dark ? 'font-semibold text-white' : 'font-semibold text-slate-950'}>{getActivityTitle(event)}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={dark ? 'border-neutral-700 bg-neutral-950 text-neutral-300' : 'border-slate-200 bg-slate-50 text-slate-700'}>
                          {eventTypeLabel(event.event_type)}
                        </Badge>
                        <span className={`text-xs ${muted}`}>{getActivityDetail(event)}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 align-top">
                      {getContactLine(event) ? (
                        <div>
                          <div className={dark ? 'text-neutral-100' : 'text-slate-800'}>{event.visitor_name || event.visitor_email || event.visitor_phone}</div>
                          <div className={`mt-1 max-w-[240px] truncate text-xs ${muted}`}>
                            {[event.visitor_email, event.visitor_phone, event.visitor_company].filter(Boolean).join(' | ')}
                          </div>
                          {event.visitor_contact_source ? <div className={`mt-1 text-[11px] uppercase ${muted}`}>{event.visitor_contact_source}</div> : null}
                        </div>
                      ) : (
                        <div>
                          <div className="font-mono text-xs">{shortVisitorId(event.visitor_id)}</div>
                          <div className={`mt-1 font-mono text-[11px] ${muted}`}>{shortVisitorId(event.visitor_session_id)}</div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 align-top">
                      {event.page_url ? (
                        <a
                          className="block max-w-[280px] truncate text-blue-600 hover:underline"
                          href={event.page_url}
                          target="_blank"
                          rel="noreferrer"
                          title={event.page_url}
                        >
                          {event.page_path || event.page_url}
                        </a>
                      ) : (
                        <span className={muted}>{event.page_path || '-'}</span>
                      )}
                      {[event.category, event.city, event.state].filter(Boolean).length ? (
                        <div className={`mt-1 text-xs ${muted}`}>
                          {[event.category, event.city, event.state].filter(Boolean).join(' / ')}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 align-top">
                      <div className={`max-w-[220px] truncate ${dark ? 'text-neutral-300' : 'text-slate-600'}`} title={event.referrer || ''}>
                        {event.utm_source || event.referrer || 'Direct'}
                      </div>
                      {event.utm_campaign ? <div className={`mt-1 text-xs ${muted}`}>{event.utm_campaign}</div> : null}
                    </td>
                    {technical ? (
                      <td className={`py-3 pr-3 align-top text-xs ${muted}`}>
                        <div className="max-w-[220px] truncate" title={event.user_agent || ''}>{event.user_agent || '-'}</div>
                        <div className="mt-1 font-mono">{event.ip_address || '-'}</div>
                      </td>
                    ) : null}
                    <td className={`py-3 pr-4 text-right align-top ${dark ? 'text-neutral-300' : 'text-slate-600'}`}>{fmtDateTime(event.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WebsiteVisitorActivityCard;
