export const successStories = [
  {
    slug: 'delhi-steel-distributors',
    title: 'Delhi Steel Distributors scaled dealer reach by 3x',
    company: 'Delhi Steel Distributors',
    excerpt: 'A regional steel supplier used IndianTradeMart to widen its buyer network and shorten response time.',
    summary: 'From scattered lead handling to a structured digital pipeline in under one quarter.',
    result: '3x growth in qualified dealer inquiries within 90 days.',
    challenge:
      'The team depended on offline referrals and delayed quote follow-ups, which slowed conversion for repeat B2B buyers.',
    solution:
      'They listed core SKUs, standardized response templates, and routed urgent buying requirements through IndianTradeMart.',
    outcome:
      'Average first-response time dropped below two hours and repeat order volume climbed steadily across Delhi NCR and nearby states.',
  },
  {
    slug: 'surat-textile-exporter',
    title: 'Surat Textile Exporter improved bulk inquiry quality',
    company: 'Surat Textile Exporter',
    excerpt: 'A textile exporter reduced low-intent inquiries and focused on larger wholesale opportunities.',
    summary: 'Better targeting and clearer product positioning brought higher-value conversations.',
    result: '42% higher bulk-order conversion from verified business buyers.',
    challenge:
      'The sales team was spending time on non-serious inquiries that did not match MOQs or export readiness requirements.',
    solution:
      'They refreshed product pages, added MOQ clarity, and directed buyers to structured inquiry flows on the platform.',
    outcome:
      'The company started attracting more export-oriented and wholesale buyers with clearer purchase intent and faster qualification.',
  },
  {
    slug: 'pune-industrial-components',
    title: 'Pune Industrial Components shortened sales cycles',
    company: 'Pune Industrial Components',
    excerpt: 'An industrial parts manufacturer used platform visibility and faster quoting to close deals faster.',
    summary: 'Operational discipline around quoting made their catalog easier to buy from.',
    result: '28% reduction in average sales-cycle length.',
    challenge:
      'Technical buyers needed rapid comparison quotes, but the internal process was inconsistent and email-heavy.',
    solution:
      'The team centralized catalog discovery, aligned quote turnaround expectations, and responded from one shared workflow.',
    outcome:
      'Procurement teams received cleaner responses earlier, which improved trust and shortened the time from inquiry to order.',
  },
  {
    slug: 'jaipur-packaging-house',
    title: 'Jaipur Packaging House expanded into new states',
    company: 'Jaipur Packaging House',
    excerpt: 'A packaging supplier used IndianTradeMart to generate cross-state demand without building a field team first.',
    summary: 'Digital lead flow created predictable expansion into new regional markets.',
    result: 'New customer acquisition across 6 additional states.',
    challenge:
      'The business wanted national reach but lacked enough local sales presence beyond Rajasthan.',
    solution:
      'They used public product visibility, inquiry capture, and centralized follow-up to test demand in new regions.',
    outcome:
      'Inbound demand from outside the home market became a reliable pipeline source, supporting expansion with lower overhead.',
  },
];

export const successStoriesBySlug = Object.fromEntries(
  successStories.map((story) => [story.slug, story])
);
