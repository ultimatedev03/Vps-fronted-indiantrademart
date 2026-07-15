import { Link } from 'react-router-dom';

const Logo = ({
  className = 'h-10',
  showTagline = true,
  variant = 'dark', // 'dark' for light bg, 'light' for dark bg
  to = '/',
  compact, // optional: true/false; if not passed, auto based on height class
  lockup = false,
}) => {
  if (lockup) {
    return (
      <Link
        to={to}
        aria-label="Indian Trade Mart"
        title="IndianTradeMart"
        className={`inline-flex items-center ${className}`}
      >
        <img
          src="/itm-logo.png"
          alt="IndianTradeMart"
          width="563"
          height="289"
          className="h-full w-auto object-contain"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </Link>
    );
  }

  // auto-compact when small heights are used (h-6/h-7/h-8)
  const autoCompact = /\bh-(6|7|8)\b/.test(className);
  const isCompact = typeof compact === 'boolean' ? compact : autoCompact;

  const gold = variant === 'light' ? 'text-white' : 'text-[#76572f]';
  const orange = variant === 'light' ? 'text-orange-400' : 'text-[#c65f12]';
  const taglineColor = variant === 'light' ? 'text-slate-300' : 'text-slate-500';

  const titleSize = isCompact
    ? 'text-sm sm:text-base'
    : 'text-base sm:text-lg md:text-xl';

  return (
    <Link
      to={to}
      aria-label="Indian Trade Mart"
      title="IndianTradeMart"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <div className="flex h-full aspect-square flex-shrink-0 items-center justify-center overflow-hidden">
        <img
          src="/itm-mark.png"
          alt="IndianTradeMART Logo"
          width="160"
          height="160"
          className="h-full w-full object-contain"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </div>

      {/* Text */}
      <div className="min-w-0 flex flex-col leading-none">
        <div
          className={`font-semibold tracking-tight whitespace-nowrap ${titleSize}`}
        >
          <span className={gold}>Indian</span>
          <span className={gold}>Trade</span>
          <span className={orange}>Mart</span>
        </div>

        {/* Tagline hidden in compact mode (sidebar/header small height) */}
        {showTagline && !isCompact && (
          <span
            className={`mt-1 hidden text-[9px] font-medium uppercase tracking-widest whitespace-nowrap sm:block sm:text-[10px] ${taglineColor}`}
          >
            Connect &amp; Grow
          </span>
        )}
      </div>
    </Link>
  );
};

export default Logo;
