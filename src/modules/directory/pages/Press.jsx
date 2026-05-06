import React, { useState } from 'react';
import {
  FooterPageAction,
  FooterPageCard,
  FooterPageSection,
  FooterPageShell,
} from '@/modules/directory/components/FooterPageShell';
import { Newspaper, Calendar, User } from 'lucide-react';

const buildContactPath = ({ subject = '', message = '' } = {}) => {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (message) params.set('message', message);
  const query = params.toString();
  return query ? `/contact?${query}` : '/contact';
};

const Press = () => {
  const [expandedId, setExpandedId] = useState(null);
  const pressReleases = [
    {
      id: 1,
      title: 'IndianTradeMart Launches New B2B Platform',
      date: 'January 15, 2025',
      author: 'Communications Team',
      excerpt: 'Revolutionary B2B marketplace connecting verified buyers and suppliers across India.',
      content: 'We are thrilled to announce the launch of our new B2B marketplace...'
    },
    {
      id: 2,
      title: 'Partnership with Leading Industry Bodies',
      date: 'January 10, 2025',
      author: 'Communications Team',
      excerpt: 'Strategic partnerships with major industry associations.',
      content: 'Our platform has partnered with leading industry bodies...'
    },
    {
      id: 3,
      title: 'Record Growth in Supplier Network',
      date: 'January 5, 2025',
      author: 'Communications Team',
      excerpt: '50,000+ suppliers now registered on our platform.',
      content: 'We are proud to announce that our supplier network has grown...'
    }
  ];

  return (
    <FooterPageShell
      eyebrow="Press"
      title="Press Section"
      description="Latest news and updates about Indian Trade Mart, now presented with stronger layout balance, cleaner cards, and clearer media contact paths."
      stats={[
        { label: 'Press releases', value: `${pressReleases.length}` },
        { label: 'Primary contact', value: 'press@indiantrademart.com' },
        { label: 'Coverage', value: 'Platform updates' },
        { label: 'Audience', value: 'Media' },
      ]}
      aside={(
        <div className="space-y-4">
          <Newspaper className="h-8 w-8 text-blue-200" />
          <p className="text-xl font-semibold text-white">A cleaner media-facing surface.</p>
          <p className="text-sm leading-6 text-slate-300">
            Press content is now easier to scan, with metadata, summaries, and contact actions grouped more intentionally.
          </p>
        </div>
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <FooterPageSection
          title="Latest announcements"
          description="Browse recent updates, partnerships, and platform milestones."
        >
          <div className="space-y-4">
            {pressReleases.map((release) => (
              <FooterPageCard key={release.id} className="space-y-4 bg-white">
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{release.title}</h2>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {release.date}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {release.author}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{release.excerpt}</p>
                  {expandedId === release.id ? (
                    <p className="text-sm leading-6 text-slate-600">{release.content}</p>
                  ) : null}
                </div>
                <button
                  className="text-sm font-semibold text-blue-700 transition hover:text-blue-900"
                  onClick={() => setExpandedId((current) => (current === release.id ? null : release.id))}
                >
                  {expandedId === release.id ? 'Show less' : 'Read more'}
                </button>
              </FooterPageCard>
            ))}
          </div>
        </FooterPageSection>

        <FooterPageSection
          title="Press contacts"
          description="Reach out with the details of your story, deadline, or interview request."
        >
          <div className="space-y-4">
            <FooterPageCard className="space-y-2 bg-white">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Media Relations</p>
              <p className="text-base font-semibold text-slate-950">press@indiantrademart.com</p>
            </FooterPageCard>
            <FooterPageCard className="space-y-2 bg-white">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Phone</p>
              <p className="text-base font-semibold text-slate-950">+91 XXXX-XXXX-XXX</p>
            </FooterPageCard>
            <FooterPageCard className="space-y-4 bg-white">
              <p className="text-sm leading-6 text-slate-600">For media inquiries, please share the publication, topic, and timeline so the right spokesperson can respond quickly.</p>
              <div className="flex flex-wrap gap-3">
                <FooterPageAction
                  to={buildContactPath({
                    subject: 'Press Inquiry',
                    message: 'Hi press team, I would like to connect regarding a media or press inquiry.',
                  })}
                >
                  Email press team
                </FooterPageAction>
                <FooterPageAction
                  to={buildContactPath({
                    subject: 'Press Contact Request',
                    message: 'Hi team, I need help with a press-related request.',
                  })}
                  variant="secondary"
                >
                  Contact form
                </FooterPageAction>
              </div>
            </FooterPageCard>
          </div>
        </FooterPageSection>
      </div>
    </FooterPageShell>
  );
};

export default Press;
