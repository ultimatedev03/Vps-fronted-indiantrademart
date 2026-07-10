import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { cn } from '@/lib/utils';

const DEFAULT_ALLOWED_TYPES = Object.freeze(['micro', 'sub']);

const CategoryTypeahead = ({
  onSelect,
  defaultValue = '',
  placeholder = 'Search category...',
  disabled = false,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
}) => {
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const selectedLabelRef = useRef(String(defaultValue || '').trim());
  const requestIdRef = useRef(0);

  const allowedTypesKey = Array.isArray(allowedTypes)
    ? allowedTypes.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean).sort().join('|')
    : '';
  const normalizedAllowedTypes = useMemo(
    () =>
      allowedTypesKey ? allowedTypesKey.split('|') : [],
    [allowedTypesKey]
  );

  useEffect(() => {
    const nextValue = String(defaultValue || '');
    setQuery(nextValue);
    selectedLabelRef.current = nextValue.trim();
  }, [defaultValue]);

  useEffect(() => {
    // Hide suggestions on click outside
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      if (selectedLabelRef.current && query.trim() === selectedLabelRef.current) {
        setSuggestions([]);
        setShow(false);
        setLoading(false);
        return;
      }
      if (query.length >= 2) {
        setLoading(true);
        try {
          // The backend autocomplete endpoint uses direct category indexes and is
          // more reliable than the legacy browser database query for this picker.
          let results = await directoryApi.autocomplete(query).catch(() => []);
          let filteredResults =
            normalizedAllowedTypes.length > 0
              ? results.filter((item) => normalizedAllowedTypes.includes(String(item?.type || '').toLowerCase()))
              : results;

          // Preserve sub-category selection and retain a fallback for older API
          // deployments where autocomplete has no category match.
          if (!filteredResults.length) {
            results = await directoryApi.searchMicroCategories(query);
            filteredResults =
              normalizedAllowedTypes.length > 0
                ? results.filter((item) => normalizedAllowedTypes.includes(String(item?.type || '').toLowerCase()))
                : results;
          }

          if (requestId !== requestIdRef.current) return;
          setSuggestions(filteredResults);
          setShow(filteredResults.length > 0);
          setHighlightIndex(-1);
        } catch (e) {
          if (requestId !== requestIdRef.current) return;
          console.error(e);
          setSuggestions([]);
          setShow(false);
        } finally {
          if (requestId === requestIdRef.current) setLoading(false);
        }
      } else {
        setSuggestions([]);
        setShow(false);
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [normalizedAllowedTypes, query]);

  const handleKeyDown = (e) => {
    if (!show || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0) {
        handleSelect(suggestions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShow(false);
    }
  };

  const handleSelect = (item) => {
    if (!item?.id || !item?.name) return;
    requestIdRef.current += 1;
    setQuery(item.name);
    selectedLabelRef.current = String(item?.name || '').trim();
    setSuggestions([]);
    setHighlightIndex(-1);
    setShow(false);
    onSelect(item);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Input
          value={query} 
          onChange={(e) => {
            const nextValue = e.target.value;
            setQuery(nextValue);
            if (!nextValue || String(nextValue).trim() !== selectedLabelRef.current) {
              selectedLabelRef.current = '';
              onSelect(null);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pr-8"
          disabled={disabled}
          disableAutoSanitize
        />
        <div className="absolute right-2 top-2.5 text-slate-400">
           {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
        </div>
      </div>
      
      {show && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto" role="listbox">
          {suggestions.map((item, idx) => (
            <button
              key={`${item.type || 'category'}:${item.id}`}
              type="button"
              className={cn(
                "block w-full px-4 py-2 cursor-pointer text-left text-sm border-b last:border-0",
                idx === highlightIndex ? "bg-blue-50 text-[#003D82]" : "hover:bg-slate-50 text-slate-700"
              )}
              // Selecting on mouse down keeps the input focused and prevents
              // browser blur/click ordering from discarding the chosen category.
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelect(item);
              }}
              role="option"
              aria-selected={idx === highlightIndex}
            >
              <div className="font-medium flex items-center gap-2">
                {item.name}
                {item.type && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${item.type === 'micro' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.type === 'micro' ? 'Micro' : 'Sub'}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                 {String(item.path || item.name).split(' > ').join(' › ')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryTypeahead;
