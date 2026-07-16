import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Handshake, MapPin, ShieldCheck } from 'lucide-react';
import MarketplaceSearchPanel from '@/modules/directory/components/MarketplaceSearchPanel';

const HeroSection = () => {
  const reduceMotion = useReducedMotion();
  const [videoReady, setVideoReady] = useState(false);

  return (
    <section className="relative isolate min-h-[540px] overflow-hidden bg-[#122238] text-white sm:min-h-[565px] lg:min-h-[590px]">
      <img
        src="/media/itm-marketplace-story.webp?v=20260716-marketplace3"
        alt="Indian manufacturing teams turning production into trusted trade"
        className="absolute inset-0 -z-30 h-full w-full object-cover object-center"
        width="1280"
        height="720"
        loading="eager"
        decoding="async"
        fetchpriority="high"
      />

      {!reduceMotion && (
        <video
          className={`pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-center transition-opacity duration-700 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/media/itm-marketplace-story.webp?v=20260716-marketplace3"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate noremoteplayback"
          onPlaying={() => setVideoReady(true)}
          onError={() => setVideoReady(false)}
          aria-hidden="true"
        >
          <source src="/media/itm-marketplace-story.webm?v=20260716-marketplace3" type="video/webm" />
        </video>
      )}

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[#07182b]/15" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(7,23,41,0.97)_0%,rgba(7,23,41,0.88)_40%,rgba(7,23,41,0.28)_72%,rgba(7,23,41,0.38)_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_46%,rgba(251,146,60,0.12),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-44 bg-[linear-gradient(180deg,transparent,rgba(6,20,36,0.9))]" />

      <div className="relative z-10 mx-auto flex min-h-[540px] w-[92vw] max-w-[1400px] flex-col justify-center py-8 sm:min-h-[565px] lg:min-h-[590px]">
        <div className="max-w-[620px]">
          <p className="mb-2.5 inline-flex border-l-2 border-orange-400 bg-black/25 px-2.5 py-1 text-[10px] font-extrabold uppercase text-orange-100 backdrop-blur-sm sm:text-[11px]">
            India's marketplace for real business intent
          </p>

          <h1 className="itm-display max-w-[620px] text-balance text-[2.1rem] leading-[1.04] text-white sm:text-[2.85rem] lg:text-[3.4rem]">
            Where Indian business finds its next
            <span className="block text-orange-400">trusted partner.</span>
          </h1>

          <p className="mt-3.5 max-w-[590px] text-sm font-medium leading-6 text-slate-100 sm:text-[15px] sm:leading-6">
            Discover active manufacturers, suppliers, products, and service partners across India, then turn business intent into a confident conversation.
          </p>
        </div>

        <div className="mt-5 w-full max-w-[820px] text-slate-900">
          <MarketplaceSearchPanel compact />
        </div>

        <div className="mt-3.5 hidden max-w-[820px] grid-cols-3 gap-3 text-[11px] font-semibold text-slate-100 lg:grid">
          <div className="flex items-center gap-2 border-t border-white/25 pt-2.5"><ShieldCheck className="h-3.5 w-3.5 text-orange-300" /> Verified business signals</div>
          <div className="flex items-center gap-2 border-t border-white/25 pt-2.5"><MapPin className="h-3.5 w-3.5 text-orange-300" /> Pan-India discovery</div>
          <div className="flex items-center gap-2 border-t border-white/25 pt-2.5"><Handshake className="h-3.5 w-3.5 text-orange-300" /> Direct business enquiries</div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
