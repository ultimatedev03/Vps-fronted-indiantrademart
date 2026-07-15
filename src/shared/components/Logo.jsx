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
    : 'text-[17px] sm:text-xl';

  return (
    <Link
      to={to}
      aria-label="Indian Trade Mart"
      title="IndianTradeMart"
      className={`inline-flex min-w-max items-center gap-2.5 ${className}`}
    >
      <div className="flex aspect-square h-full flex-shrink-0 items-center justify-center overflow-hidden">
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

      <div className="min-w-0 flex flex-col leading-none">
        <div
          className={`whitespace-nowrap font-semibold tracking-normal ${titleSize}`}
        >
          <span className={gold}>Indian</span>
          <span className={gold}>Trade</span>
          <span className={orange}>Mart</span>
        </div>

        {showTagline && !isCompact && (
          <span
            className={`mt-1 whitespace-nowrap text-[8px] font-semibold uppercase tracking-normal sm:text-[9px] ${taglineColor}`}
          >
            Connect &amp; Grow
          </span>
        )}
      </div>
    </Link>
  );
};

export default Logo;
