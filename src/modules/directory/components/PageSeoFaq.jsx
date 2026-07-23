import React from 'react';
import { ChevronDown } from 'lucide-react';

import { getPageSeoFaqItems } from '@/modules/directory/seo/pageSeoOverrides';

const PageSeoFaq = ({ schema, className = '' }) => {
  const items = getPageSeoFaqItems(schema);
  if (!items.length) return null;

  return (
    <section
      aria-labelledby="page-seo-faq-heading"
      className={`border-t border-slate-200 bg-white py-10 ${className}`.trim()}
    >
      <div className="mx-auto w-[92vw] max-w-5xl">
        <p className="text-xs font-semibold uppercase text-orange-600">Buyer guide</p>
        <h2
          id="page-seo-faq-heading"
          className="mt-2 text-2xl font-bold text-slate-950"
        >
          Frequently asked questions
        </h2>
        <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
          {items.map((item) => (
            <details key={item.question} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                <span>{item.question}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="max-w-3xl pt-3 text-sm leading-6 text-slate-600">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PageSeoFaq;
