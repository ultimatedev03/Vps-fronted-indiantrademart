import React from 'react';
import { Helmet } from 'react-helmet';

const sections = [
  {
    title: 'Marketplace use',
    body:
      'By using Indian Trade Mart, you agree to use the platform lawfully, provide accurate information, and avoid misuse of listings, communication tools, access controls, or marketplace data.',
  },
  {
    title: 'Accounts and responsibilities',
    body:
      'Users are responsible for maintaining accurate profile details, safeguarding credentials, and ensuring that information, listings, and communications submitted through the marketplace are truthful and authorized.',
  },
  {
    title: 'Listings, enquiries, and content',
    body:
      'Suppliers and buyers remain responsible for the accuracy of their own content, product or service claims, quotations, business information, and commercial discussions carried out through or because of the platform.',
  },
  {
    title: 'Payments, plans, and services',
    body:
      'Any paid features, subscriptions, promotional services, or operational support offered through Indian Trade Mart may be governed by additional commercial terms, pricing, billing, and eligibility conditions.',
  },
  {
    title: 'Intellectual property',
    body:
      'Indian Trade Mart branding, platform design, software, and site content are protected by applicable intellectual property rights. Users must not copy, scrape, redistribute, or misuse platform materials without permission.',
  },
  {
    title: 'Limitations and enforcement',
    body:
      'We may suspend, restrict, or remove access where accounts or content create legal, operational, security, fraud, or quality risks. Platform availability and results are provided on a reasonable-efforts basis.',
  },
];

const TermsOfUse = () => {
  return (
    <div className="bg-slate-50">
      <Helmet>
        <title>Terms of Use | Indian Trade Mart</title>
        <meta
          name="description"
          content="Review the Indian Trade Mart Terms of Use covering marketplace access, account responsibilities, listings, content, and platform conduct."
        />
      </Helmet>

      <section className="bg-slate-950 text-white">
        <div className="container mx-auto px-4 py-16">
          <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
            Legal
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">Terms of Use</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            These terms describe the main rules for accessing and using the Indian Trade Mart marketplace, public
            listings, account areas, and communication features.
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
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Questions about these terms</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            For questions about platform use, account conduct, or commercial support, contact{' '}
            <a href="mailto:support@indiantrademart.com" className="font-semibold text-slate-900">support@indiantrademart.com</a>.
          </p>
        </div>
      </section>
    </div>
  );
};

export default TermsOfUse;
