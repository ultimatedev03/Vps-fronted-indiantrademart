import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const actionVariants = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-300',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950',
  dark:
    'inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900',
};

export const FooterPageShell = ({ eyebrow, title, description, stats = [], aside, children }) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_48%,#f8fafc_100%)] text-slate-900">
    <section className="relative overflow-hidden border-b border-slate-200/80 bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.24),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.28),_transparent_35%)]" />
      <div className="absolute -left-16 top-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/4 translate-y-1/4 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="container relative mx-auto px-4 py-16 md:py-20">
        <div className={cn('grid gap-8', aside ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)] lg:items-end' : '')}>
          <div className="max-w-3xl space-y-5">
            {eyebrow ? (
              <span className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-100">
                {eyebrow}
              </span>
            ) : null}
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">{title}</h1>
            {description ? <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">{description}</p> : null}
          </div>

          {aside ? (
            <div className="rounded-[28px] border border-white/12 bg-white/10 p-6 shadow-2xl shadow-slate-950/35 backdrop-blur-sm md:p-7">
              {aside}
            </div>
          ) : null}
        </div>

        {stats.length ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={`${stat.label}-${stat.value}`}
                className="min-w-0 rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-sm"
              >
                <p className="break-all text-xl font-semibold leading-tight text-white sm:text-2xl">{stat.value}</p>
                <p className="mt-1 text-sm text-slate-300">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>

    <main className="relative">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="space-y-8">{children}</div>
      </div>
    </main>
  </div>
);

export const FooterPageSection = ({ title, description, action, className, children }) => (
  <section
    className={cn(
      'rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur md:p-8',
      className,
    )}
  >
    {(title || description || action) ? (
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200/80 pb-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          {title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2> : null}
          {description ? <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    ) : null}
    {children}
  </section>
);

export const FooterPageCard = ({ className, children }) => (
  <div className={cn('rounded-[24px] border border-slate-200 bg-slate-50/85 p-5 shadow-sm', className)}>
    {children}
  </div>
);

export const FooterPageAction = ({ to, href, variant = 'primary', className, icon = true, children, ...props }) => {
  const content = (
    <>
      <span>{children}</span>
      {icon ? <ArrowRight className="h-4 w-4" /> : null}
    </>
  );
  const classes = cn(actionVariants[variant] || actionVariants.primary, className);

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href} className={classes} {...props}>
      {content}
    </a>
  );
};

export const FooterPageBulletList = ({ items = [], className }) => (
  <ul className={cn('space-y-3 text-sm leading-6 text-slate-600', className)}>
    {items.map((item) => (
      <li key={item} className="flex gap-3">
        <span className="mt-2 h-2 w-2 flex-none rounded-full bg-emerald-500" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);
