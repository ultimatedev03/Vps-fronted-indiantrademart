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

const MarketplaceSearchPanel = ({ className = '', compact = false }) => {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [mode, setMode] = useState('product');
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
      <div className="border border-slate-200/90 bg-white p-2.5 shadow-[0_24px_65px_rgba(15,23,42,0.18)] sm:p-3">
        <div className="mb-2 grid grid-cols-2 gap-1 sm:flex sm:flex-wrap" role="tablist" aria-label="Marketplace search mode">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={`min-h-9 px-3 text-xs font-bold transition-colors sm:text-sm ${
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

        <form className="relative flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => query.trim().length >= 2 && setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={activeMode.placeholder}
              aria-label={activeMode.label}
              autoComplete="off"
              className={`${compact ? 'h-12' : 'h-14'} w-full border border-slate-200 bg-[#f6f7f7] pl-12 pr-12 text-sm font-semibold text-slate-950 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-200 sm:text-base`}
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
            className={`${compact ? 'h-12' : 'h-14'} inline-flex flex-shrink-0 items-center justify-center gap-3 bg-orange-500 px-6 text-sm font-extrabold text-slate-950 shadow-sm transition hover:bg-orange-400 sm:px-8 sm:text-base`}
          >
            Get Free Quotes <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="mt-4 hidden grid-cols-2 gap-2 text-xs font-bold text-slate-700 sm:grid sm:grid-cols-4 sm:text-sm">
        <div className="flex min-h-12 items-center gap-2 border border-slate-200 bg-white/95 px-3"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Verified Suppliers</div>
        <div className="flex min-h-12 items-center gap-2 border border-slate-200 bg-white/95 px-3"><UserRoundCheck className="h-4 w-4 text-emerald-600" /> Secure Enquiries</div>
        <div className="flex min-h-12 items-center gap-2 border border-slate-200 bg-white/95 px-3"><Building2 className="h-4 w-4 text-emerald-600" /> Free Registration</div>
        <div className="flex min-h-12 items-center gap-2 border border-slate-200 bg-white/95 px-3"><Zap className="h-4 w-4 text-emerald-600" /> Fast Response</div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/vendor/register')}
        className="mt-4 min-h-10 border border-slate-300 bg-white px-5 text-sm font-extrabold text-slate-900 shadow-sm transition hover:border-orange-400 hover:text-orange-700"
      >
        Register as a Supplier
      </button>
    </div>
  );
};

export default MarketplaceSearchPanel;
