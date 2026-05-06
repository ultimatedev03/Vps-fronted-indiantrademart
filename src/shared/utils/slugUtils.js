import { supabase } from '@/lib/customSupabaseClient';

const MAX_SLUG_LENGTH = 100;
const FALLBACK_PRODUCT_SLUG = 'product';

const clampSlug = (value = '', maxLength = MAX_SLUG_LENGTH) => {
  const safeValue = String(value || '').trim().replace(/^-+|-+$/g, '');
  if (!safeValue) return '';

  const trimmed = safeValue.slice(0, maxLength).replace(/-+$/g, '');
  return trimmed || '';
};

const parseMetadataObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value };
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
};

const parseLegacySlugArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => clampSlug(entry))
    .filter(Boolean);
};

/**
 * Generate a URL-friendly slug from text.
 */
export const generateSlug = (text) => {
  if (!text) return '';

  return clampSlug(
    String(text || '')
      .toLowerCase()
      .trim()
      .replace(/&/g, 'and')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  );
};

const buildSlugWithSuffix = (baseSlug, suffix, maxLength = MAX_SLUG_LENGTH) => {
  const suffixText = `-${suffix}`;
  const trimmedBase = clampSlug(baseSlug, Math.max(1, maxLength - suffixText.length));
  return clampSlug(`${trimmedBase}${suffixText}`, maxLength) || FALLBACK_PRODUCT_SLUG;
};

const getLegacyRandomSuffix = (slug = '', sourceText = '') => {
  const normalizedSlug = clampSlug(slug);
  if (!normalizedSlug) return null;

  const baseSlug = clampSlug(generateSlug(sourceText) || FALLBACK_PRODUCT_SLUG);
  if (!baseSlug || normalizedSlug === baseSlug) return null;
  if (!normalizedSlug.startsWith(`${baseSlug}-`)) return null;

  const suffix = normalizedSlug.slice(baseSlug.length + 1);
  return /^[a-z0-9]{6}$/i.test(suffix) ? suffix.toLowerCase() : null;
};

export const stripLegacyRandomSlugSuffix = (slug, sourceText = '') => {
  const normalizedSlug = clampSlug(slug);
  if (!normalizedSlug) return '';

  const baseSlug = clampSlug(generateSlug(sourceText));
  if (baseSlug && getLegacyRandomSuffix(normalizedSlug, sourceText)) {
    return baseSlug;
  }

  if (!sourceText) {
    const genericMatch = normalizedSlug.match(/^(.*)-([a-z0-9]{6})$/i);
    if (genericMatch?.[1]) return clampSlug(genericMatch[1]);
  }

  return normalizedSlug;
};

export const isLegacyRandomizedSlug = (slug, sourceText = '') => {
  if (!sourceText) {
    return /^(.*)-([a-z0-9]{6})$/i.test(clampSlug(slug));
  }
  return Boolean(getLegacyRandomSuffix(slug, sourceText));
};

export const needsProductSlugNormalization = (slug, sourceText = '') => {
  const normalizedSlug = clampSlug(slug);
  if (!normalizedSlug) return true;
  return isLegacyRandomizedSlug(normalizedSlug, sourceText);
};

export const mergeProductSlugAliases = (metadata, slugCandidates = [], canonicalSlug = '') => {
  const nextMetadata = parseMetadataObject(metadata);
  const normalizedCanonicalSlug = clampSlug(canonicalSlug);
  const aliases = [];
  const seen = new Set();

  const pushAlias = (value) => {
    const normalizedValue = clampSlug(value);
    if (!normalizedValue) return;
    if (normalizedCanonicalSlug && normalizedValue === normalizedCanonicalSlug) return;
    if (seen.has(normalizedValue)) return;
    seen.add(normalizedValue);
    aliases.push(normalizedValue);
  };

  pushAlias(nextMetadata.legacy_slug);
  parseLegacySlugArray(nextMetadata.legacy_slugs).forEach(pushAlias);
  (Array.isArray(slugCandidates) ? slugCandidates : [slugCandidates]).forEach(pushAlias);

  delete nextMetadata.legacy_slug;
  delete nextMetadata.legacy_slugs;

  if (!aliases.length) {
    return nextMetadata;
  }

  return {
    ...nextMetadata,
    legacy_slug: aliases[0],
    legacy_slugs: aliases,
  };
};

/**
 * Generate a readable unique slug using numeric suffixes when needed.
 */
export const generateUniqueSlug = async (text, options = {}) => {
  const {
    table = 'products',
    column = 'slug',
    excludeId = null,
    fallback = FALLBACK_PRODUCT_SLUG,
    maxLength = MAX_SLUG_LENGTH,
  } = options;

  const baseSlug = clampSlug(generateSlug(text) || fallback, maxLength) || fallback;
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    let query = supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, candidate);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;
    if (error) throw error;

    if (!Number(count)) {
      return candidate;
    }

    candidate = buildSlugWithSuffix(baseSlug, suffix, maxLength);
    suffix += 1;
  }
};
