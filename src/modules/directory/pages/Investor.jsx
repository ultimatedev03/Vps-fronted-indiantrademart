import React from 'react';
import {
  FooterPageAction,
  FooterPageCard,
  FooterPageSection,
  FooterPageShell,
} from '@/modules/directory/components/FooterPageShell';
import { TrendingUp, FileText, BarChart3 } from 'lucide-react';

const buildContactPath = ({ subject = '', message = '' } = {}) => {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (message) params.set('message', message);
  const query = params.toString();
  return query ? `/contact?${query}` : '/contact';
};

const Investor = () => {
  return (
    <FooterPageShell
      eyebrow="Investor Relations"
      title="Information for investors and stakeholders"
      description="The investor page now matches the public site more closely, with clearer cards, cleaner spacing, and better CTA visibility."
      stats={[
        { label: 'Report access', value: 'On request' },
        { label: 'Governance path', value: 'Available' },
        { label: 'Investor email', value: 'investors@indiantrademart.com' },
        { label: 'Audience', value: 'Stakeholders' },
      ]}
      aside={(
        <div className="space-y-4">
          <TrendingUp className="h-8 w-8 text-blue-200" />
          <p className="text-xl font-semibold text-white">A more credible investor-facing layout.</p>
          <p className="text-sm leading-6 text-slate-300">
            Financial and governance content is now presented through balanced sections instead of generic stacked boxes.
          </p>
        </div>
      )}
    >
      <FooterPageSection
        title="Investor resources"
        description="Access core information paths for reports, governance, and investor communication."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FooterPageCard className="space-y-4 bg-white">
            <BarChart3 className="h-6 w-6 text-blue-700" />
            <h2 className="text-2xl font-semibold text-slate-950">Financial Reports</h2>
            <p className="text-sm leading-6 text-slate-600">Request the latest financial statements, updates, and investor materials.</p>
            <FooterPageAction
              to={buildContactPath({
                subject: 'Investor Reports Request',
                message: 'Hi team, I would like to request the latest investor or financial reports.',
              })}
            >
              Request reports
            </FooterPageAction>
          </FooterPageCard>

          <FooterPageCard className="space-y-4 bg-white">
            <FileText className="h-6 w-6 text-emerald-600" />
            <h2 className="text-2xl font-semibold text-slate-950">Governance</h2>
            <p className="text-sm leading-6 text-slate-600">Review corporate governance policies, background information, and company context.</p>
            <FooterPageAction to="/about-us" variant="secondary">Learn more</FooterPageAction>
          </FooterPageCard>
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="Contact investor relations"
        description="Use the details below for investor-specific communication and document requests."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FooterPageCard className="space-y-2 bg-white">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Email</p>
            <p className="text-base font-semibold text-slate-950">investors@indiantrademart.com</p>
          </FooterPageCard>
          <FooterPageCard className="space-y-2 bg-white">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Phone</p>
            <p className="text-base font-semibold text-slate-950">+91 XXXX-XXXX-XXX</p>
          </FooterPageCard>
        </div>
      </FooterPageSection>
    </FooterPageShell>
  );
};

export default Investor;
