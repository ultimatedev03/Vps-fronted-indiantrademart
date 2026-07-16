import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Building2, Loader2, MapPin, Search, ShieldCheck, UserRoundCheck, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { getProductDetailPath } from '@/shared/utils/productRoutes';
import { getVendorProfilePath } from '@/shared/utils/vendorRoutes';

const MODES = [
  { id: 'product', label: 'Search by Product', placeholder: 'e.g. hydraulic press machine' },
  { id: 'category', label: 'Search by Category', placeholder: 'e.g. industrial machinery' },
  { id: 'supplier', label: 'Search by Supplier', placeholder: 'e.g. Bharat Heavy Tools' },
  { id: 'city', label: 'Search by City', placeholder: 'e.g. Mumbai' },
];

const slugify = (value = '') => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const resolveSuggestionPath = (item = {}) => {
  if (item.href) return item.href;
  if (item.path && String(item.path).startsWith('/')) return item.path;
  if (item.type === 'product') return getProductDetailPath(item.product_slug || item.slug || item.id);
  if (item.type === 'vendor' || item.type === 'supplier') {
    return getVendorProfilePath(item.slug || item.id);
  }
  if (item.type === 'city') return `/directory/city/${encodeURIComponent(item.slug || slugify(item.name))}`;
  return item.slug ? `/directory/${item.slug}` : null;
};

const MarketplaceSearchPanel = ({ className = '', compact = false, defaultMode = 'product' }) => {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [mode, setMode] = useState(() => (
    MODES.some((item) => item.id === defaultMode) ? defaultMode : 'product'
  ));
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const activeMode = useMemo(() => MODES.find((item) => item.id === mode) || MODES[0], [mode]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const value = query.trim();
    setActiveIndex(-1);
    if (value.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await directoryApi.autocomplete(value, mode);
        if (active) {
          setSuggestions(Array.isArray(rows) ? rows.slice(0, 8) : []);
          setOpen(true);
        }
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [mode, query]);

  const goToSuggestion = (item) => {
    const path = resolveSuggestionPath(item);
    if (!path) return false;
    setOpen(false);
    navigate(path);
    return true;
  };

  const submitSearch = (event) => {
    event?.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (activeIndex >= 0 && suggestions[activeIndex] && goToSuggestion(suggestions[activeIndex])) return;

    const slug = slugify(value);
    if (mode === 'supplier') {
      navigate(`/directory/vendor?q=${encodeURIComponent(value)}`);
      return;
    }
    if (mode === 'city') {
      navigate(`/directory/vendor?cityText=${encodeURIComponent(value)}`);
      return;
    }
    navigate(`/directory/search/${encodeURIComponent(slug)}?q=${encodeURIComponent(value)}`);
  };

  const onKeyDown = (event) => {
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={panelRef} className={`w-full ${className}`}>
      <div className={`border border-slate-200/90 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.16)] ${compact ? 'p-1.5 sm:p-2' : 'p-2 sm:p-2.5'}`}>
        <div className={`${compact ? 'mb-1' : 'mb-1.5'} grid grid-cols-2 gap-1 sm:flex sm:flex-wrap`} role="tablist" aria-label="Marketplace search mode">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={`${compact ? 'min-h-7 px-2 text-[10px] sm:text-[11px]' : 'min-h-8 px-2.5 text-[11px] sm:text-xs'} font-bold transition-colors ${
                mode === item.id
                  ? 'bg-[#0a2342] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              }`}
              onClick={() => {
                setMode(item.id);
                setSuggestions([]);
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form className={`relative flex flex-col ${compact ? 'gap-1' : 'gap-1.5'} sm:flex-row`} onSubmit={submitSearch}>
          <div className="relative min-w-0 flex-1">
            <Search className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-500 ${compact ? 'left-3 h-4 w-4' : 'left-4 h-5 w-5'}`} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => query.trim().length >= 2 && setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={activeMode.placeholder}
              aria-label={activeMode.label}
              autoComplete="off"
              className={`${compact ? 'h-10 pl-9 pr-9 text-[13px]' : 'h-[52px] pl-11 pr-11 text-sm'} w-full border border-slate-200 bg-[#f6f7f7] font-semibold text-slate-950 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-200`}
            />
            {loading && <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-orange-500" />}

            {open && query.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden border border-slate-200 bg-white text-left shadow-2xl">
                {suggestions.length ? suggestions.map((item, index) => (
                  <button
                    key={`${item.type || mode}-${item.id || item.slug || index}`}
                    type="button"
                    className={`flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-0 ${activeIndex === index ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => goToSuggestion(item)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{item.name}</span>
                      <span className="block truncate text-xs text-slate-500">{item.context || item.path || item.type || activeMode.label}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-orange-500" />
                  </button>
                )) : !loading ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Press Enter to search for “{query.trim()}”.</div>
                ) : null}
              </div>
            )}
          </div>

          <button
            type="submit"
            className={`${compact ? 'h-10 gap-2 px-4 text-[13px] sm:px-5' : 'h-[52px] gap-2.5 px-5 text-sm sm:px-7'} inline-flex flex-shrink-0 items-center justify-center bg-orange-500 font-extrabold text-slate-950 shadow-sm transition hover:bg-orange-400`}
          >
            Get Free Quotes <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className={`${compact ? 'mt-2 gap-1 text-[10px]' : 'mt-3 gap-1.5 text-xs'} hidden grid-cols-2 font-bold text-slate-700 sm:grid sm:grid-cols-4`}>
        <div className={`${compact ? 'min-h-8 gap-1.5 px-2' : 'min-h-10 gap-2 px-2.5'} flex items-center border border-slate-200 bg-white/95`}><ShieldCheck className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-emerald-600`} /> Verified Suppliers</div>
        <div className={`${compact ? 'min-h-8 gap-1.5 px-2' : 'min-h-10 gap-2 px-2.5'} flex items-center border border-slate-200 bg-white/95`}><UserRoundCheck className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-emerald-600`} /> Secure Enquiries</div>
        <div className={`${compact ? 'min-h-8 gap-1.5 px-2' : 'min-h-10 gap-2 px-2.5'} flex items-center border border-slate-200 bg-white/95`}><Building2 className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-emerald-600`} /> Free Registration</div>
        <div className={`${compact ? 'min-h-8 gap-1.5 px-2' : 'min-h-10 gap-2 px-2.5'} flex items-center border border-slate-200 bg-white/95`}><Zap className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-emerald-600`} /> Fast Response</div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/vendor/register')}
        className={`${compact ? 'mt-2 min-h-8 px-3 text-[11px]' : 'mt-3 min-h-9 px-4 text-xs'} border border-slate-300 bg-white font-extrabold text-slate-900 shadow-sm transition hover:border-orange-400 hover:text-orange-700`}
      >
        Register as a Supplier
      </button>
    </div>
  );
};

export default MarketplaceSearchPanel;
