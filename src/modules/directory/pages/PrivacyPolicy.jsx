import React from 'react';
import { Helmet } from 'react-helmet';

const sections = [
  {
    title: 'Information we collect',
    body:
      'We may collect account details, business profile information, contact information, enquiry content, communication history, and basic usage or device information needed to operate, secure, and improve the marketplace.',
  },
  {
    title: 'How we use information',
    body:
      'Information is used to create and manage accounts, support supplier discovery, route buyer and seller enquiries, provide support, improve platform quality, and meet legal, fraud-prevention, and operational requirements.',
  },
  {
    title: 'Sharing and disclosure',
    body:
      'We share information only where it is necessary to run the marketplace, provide requested services, support communication between users, work with service providers, or comply with legal obligations.',
  },
  {
    title: 'Cookies and analytics',
    body:
      'The site may use cookies or similar technologies for authentication, security, performance, analytics, and product improvement. You can manage browser-level cookie preferences, but some features may depend on them.',
  },
  {
    title: 'Security and retention',
    body:
      'We use reasonable administrative and technical safeguards to protect data, but no internet-based system is completely risk-free. Data is retained for as long as needed for business, support, legal, and compliance purposes.',
  },
  {
    title: 'Your choices',
    body:
      'You can update account details, request support, and contact us regarding data-related questions. Marketplace records may still be retained where required for legal, contractual, fraud-prevention, or operational reasons.',
  },
];

const PrivacyPolicy = () => {
  return (
    <div className="bg-slate-50">
      <Helmet>
        <title>Privacy Policy | Indian Trade Mart</title>
        <meta
          name="description"
          content="Read the Indian Trade Mart Privacy Policy to understand how marketplace information is collected, used, protected, and handled."
        />
      </Helmet>

      <section className="bg-slate-950 text-white">
        <div className="container mx-auto px-4 py-16">
          <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
            Legal
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            This page explains the types of information Indian Trade Mart may collect, how that information is used in
            operating the marketplace, and the main controls available to users.
          </p>
          <p className="mt-4 text-sm text-slate-400">Last updated: March 23, 2026</p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="space-y-8">
            {sections.map((section) => (
              <article key={section.title} className="border-b border-slate-200 pb-8 last:border-b-0 last:pb-0">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Contact for privacy questions</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            If you have questions about this policy or how your information is handled on Indian Trade Mart, contact
            the team at <a href="mailto:support@indiantrademart.com" className="font-semibold text-slate-900">support@indiantrademart.com</a>.
          </p>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
