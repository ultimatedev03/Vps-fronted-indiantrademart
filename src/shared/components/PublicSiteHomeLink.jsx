import React from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { getPublicSiteUrl } from '@/shared/lib/publicSite';

const TONE_CLASS = {
  light:
    'border-slate-200/90 bg-white/90 text-slate-700 shadow-lg shadow-slate-200/60 hover:border-slate-300 hover:bg-white hover:text-slate-900',
  dark:
    'border-white/10 bg-slate-950/70 text-slate-200 shadow-lg shadow-black/25 hover:border-white/20 hover:bg-slate-900/90 hover:text-white',
};

const PublicSiteHomeLink = ({ tone = 'light', className = '' }) => {
  const toneClass = TONE_CLASS[tone] || TONE_CLASS.light;

  return (
    <a
      href={getPublicSiteUrl(typeof window !== 'undefined' ? window.location : null)}
      className={`absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 ${toneClass} ${className}`.trim()}
    >
      <ArrowLeft className="h-4 w-4" />
      <Home className="h-4 w-4" />
      <span>Back to Home</span>
    </a>
  );
};

export default PublicSiteHomeLink;
