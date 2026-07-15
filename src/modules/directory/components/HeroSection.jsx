import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Handshake, MapPin, ShieldCheck } from 'lucide-react';
import MarketplaceSearchPanel from '@/modules/directory/components/MarketplaceSearchPanel';

const HeroSection = () => {
  const reduceMotion = useReducedMotion();
  const [videoReady, setVideoReady] = useState(false);

  return (
    <section className="relative isolate min-h-[650px] overflow-hidden bg-[#122238] text-white sm:min-h-[690px] lg:min-h-[720px]">
      <img
        src="/media/itm-marketplace-story.webp?v=20260716-story"
        alt="Indian business leaders building a trusted supplier partnership"
        className="absolute inset-0 -z-30 h-full w-full object-cover object-[66%_center] sm:object-center"
        width="1600"
        height="900"
        loading="eager"
        decoding="async"
        fetchpriority="high"
      />

      {!reduceMotion && (
        <video
          className={`pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-[66%_center] transition-opacity duration-700 sm:object-center ${videoReady ? 'opacity-100' : 'opacity-0'}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/media/itm-marketplace-story.webp?v=20260716-story"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate noremoteplayback"
          onCanPlay={() => setVideoReady(true)}
          aria-hidden="true"
        >
          <source src="/media/itm-marketplace-story.webm?v=20260716-story" type="video/webm" />
        </video>
      )}

      <div className="pointer-events-none absolute inset-0 -z-10 bg-black/15" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,25,44,0.95)_0%,rgba(8,25,44,0.82)_43%,rgba(8,25,44,0.22)_78%,rgba(8,25,44,0.34)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(180deg,transparent,rgba(8,25,44,0.82))]" />

      <div className="relative z-10 mx-auto flex min-h-[650px] w-[92vw] max-w-[1460px] flex-col justify-center py-10 sm:min-h-[690px] sm:py-12 lg:min-h-[720px]">
        <div className="max-w-[760px]">
          <p className="mb-4 inline-flex border-l-2 border-orange-400 bg-black/25 px-3 py-2 text-xs font-extrabold uppercase text-orange-100 backdrop-blur-sm sm:text-sm">
            India's marketplace for real business intent
          </p>

          <h1 className="itm-display max-w-[760px] text-balance text-[2.6rem] leading-[0.98] text-white sm:text-6xl lg:text-[4.8rem]">
            Where Indian business finds its next
            <span className="block text-orange-400">trusted partner.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-100 sm:text-lg sm:leading-8">
            Discover active manufacturers, suppliers, products, and service partners across India, then turn business intent into a confident conversation.
          </p>
        </div>

        <div className="mt-7 w-full max-w-[1020px] text-slate-900">
          <MarketplaceSearchPanel />
        </div>

        <div className="mt-5 hidden max-w-[1020px] grid-cols-3 gap-3 text-sm font-semibold text-slate-100 lg:grid">
          <div className="flex items-center gap-2 border-t border-white/25 pt-3"><ShieldCheck className="h-4 w-4 text-orange-300" /> Verified business signals</div>
          <div className="flex items-center gap-2 border-t border-white/25 pt-3"><MapPin className="h-4 w-4 text-orange-300" /> Pan-India discovery</div>
          <div className="flex items-center gap-2 border-t border-white/25 pt-3"><Handshake className="h-4 w-4 text-orange-300" /> Direct business enquiries</div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
