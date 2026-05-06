import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Building2,
  Globe2,
  Handshake,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

const stats = [
  { label: 'Marketplace focus', value: 'B2B sourcing' },
  { label: 'Business reach', value: 'Pan-India' },
  { label: 'Core audience', value: 'Buyers + suppliers' },
  { label: 'Operating model', value: 'Verified discovery' },
];

const valueBlocks = [
  {
    icon: ShieldCheck,
    title: 'Trust before volume',
    description:
      'We focus on helping businesses discover credible suppliers, clearer business details, and stronger profile quality instead of noisy low-intent listings.',
  },
  {
    icon: TrendingUp,
    title: 'Growth with structure',
    description:
      'Indian Trade Mart is designed to help small, medium, and enterprise businesses turn digital visibility into qualified enquiries and repeat demand.',
  },
  {
    icon: Handshake,
    title: 'Faster business connection',
    description:
      'From category discovery to direct enquiry, the platform aims to reduce friction for both sourcing teams and sellers trying to reach the right buyer.',
  },
];

const storyPoints = [
  'Indian Trade Mart was built to make supplier discovery more organized, more transparent, and more actionable for Indian businesses.',
  'The platform brings together product listings, service providers, city coverage, category depth, and buyer-supplier communication into one operating layer.',
  'Our direction is simple: make it easier for businesses to get found, get compared, and get contacted with more confidence.',
];

const audienceCards = [
  {
    icon: Building2,
    title: 'For suppliers',
    description:
      'Create a stronger digital presence, improve listing quality, and respond to relevant buyer demand with a more professional public profile.',
  },
  {
    icon: Users,
    title: 'For buyers',
    description:
      'Search categories, compare suppliers across cities, and reach businesses with clearer business information and easier contact paths.',
  },
  {
    icon: Globe2,
    title: 'For the market',
    description:
      'Increase discoverability for Indian businesses across manufacturing, services, trade support, and regional supplier ecosystems.',
  },
];

const milestones = [
  {
    title: 'Marketplace discovery',
    description: 'Directory, city, product, and supplier pages are designed to help buyers reach relevant business listings faster.',
  },
  {
    title: 'Business enablement',
    description: 'Vendor tools support profile quality, product visibility, lead workflows, and marketplace readiness.',
  },
  {
    title: 'Operational support',
    description: 'Admin, support, and sales modules help maintain quality, responsiveness, and follow-through across the platform.',
  },
];

const AboutUs = () => {
  return (
    <div className="bg-slate-50">
      <Helmet>
        <title>About Indian Trade Mart | Our Mission, Marketplace Focus & Business Story</title>
        <meta
          name="description"
          content="Learn about Indian Trade Mart, our B2B marketplace mission, how we support buyers and suppliers, and the platform principles guiding our growth."
        />
      </Helmet>

      <section className="bg-slate-950 text-white">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                About Indian Trade Mart
              </span>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
                  Building a clearer B2B marketplace for Indian buyers and suppliers.
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-slate-300">
                  Indian Trade Mart helps businesses discover products, suppliers, and service providers through a more
                  structured marketplace experience focused on trust, discoverability, and practical business outcomes.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {stats.map((item) => (
                <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-2xl font-bold text-white">{item.value}</div>
                  <div className="mt-2 text-sm text-slate-300">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-700">Our Mission</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Make business discovery more useful, not more crowded.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            We want businesses to spend less time navigating noise and more time reaching suppliers, categories, and
            contacts that are relevant to their actual requirement.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {valueBlocks.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">Our Story</h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              {storyPoints.map((point) => (
                <p key={point}>{point}</p>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight">What the platform is designed to improve</h2>
            <div className="mt-6 space-y-5 text-sm leading-7 text-slate-300">
              {milestones.map((item) => (
                <div key={item.title} className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  <p className="mt-2">{item.description}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">Who We Serve</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Built for marketplace participants across the trade cycle.</h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {audienceCards.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">Want to learn more or work with us?</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Explore the marketplace, browse supplier listings, or reach out to the team if you want to know more
              about partnerships, buyer support, or supplier growth opportunities.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
            <Link
              to="/directory"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Explore directory
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-950"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutUs;
