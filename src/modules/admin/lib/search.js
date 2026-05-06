const EXACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export const normalizeSearchText = (value) => String(value || '').trim().toLowerCase();

const normalizeLooseSearchText = (value) =>
  normalizeSearchText(value).replace(/[^a-z0-9]/g, '');

export const matchesSearchCandidate = (candidate, term) => {
  const rawCandidate = normalizeSearchText(candidate);
  const rawTerm = normalizeSearchText(term);

  if (!rawTerm) return true;
  if (rawCandidate.includes(rawTerm)) return true;

  const looseTerm = normalizeLooseSearchText(rawTerm);
  if (!looseTerm) return false;

  return normalizeLooseSearchText(candidate).includes(looseTerm);
};

export const filterRecordsBySearch = (
  records,
  rawTerm,
  {
    exactIdKeys = [],
    exactEmailKeys = [],
    broadKeys = [],
  } = {}
) => {
  const term = normalizeSearchText(rawTerm);
  if (!term) return Array.isArray(records) ? records : [];

  const list = Array.isArray(records) ? records : [];
  const exactEmailSearch = EXACT_EMAIL_RE.test(String(rawTerm || '').trim());
  const exactIdMatches = [];
  const exactEmailMatches = [];
  const broadMatches = [];

  list.forEach((record) => {
    const hasExactIdMatch = exactIdKeys.some((key) => {
      const candidate = normalizeSearchText(record?.[key]);
      return candidate && candidate === term;
    });

    if (hasExactIdMatch) {
      exactIdMatches.push(record);
      return;
    }

    if (exactEmailSearch) {
      const hasExactEmailMatch = exactEmailKeys.some((key) => {
        const candidate = normalizeSearchText(record?.[key]);
        return candidate && candidate === term;
      });

      if (hasExactEmailMatch) {
        exactEmailMatches.push(record);
      }
      return;
    }

    const hasBroadMatch = broadKeys.some((key) => matchesSearchCandidate(record?.[key], term));
    if (hasBroadMatch) {
      broadMatches.push(record);
    }
  });

  if (exactIdMatches.length) return exactIdMatches;
  if (exactEmailSearch) return exactEmailMatches;
  return broadMatches;
};
