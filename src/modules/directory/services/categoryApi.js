import { apiUrl } from '@/lib/apiBase';

const readJson = async (res) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || `Request failed (${res.status})`);
  }
};

const fetchCategoryJson = async (path) => {
  const res = await fetch(apiUrl(path), { headers: { Accept: 'application/json' } });
  const json = await readJson(res);
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || json?.message || `Request failed (${res.status})`);
  }
  return json;
};

export const categoryApi = {
  // ✅ Fetch top-level categories (Head Categories)
  getTopLevelCategories: async () => {
    try {
      const json = await fetchCategoryJson('/api/dir/categories/top-level');
      return json?.categories || [];
    } catch (err) {
      console.error('Unexpected error fetching top level categories:', err);
      return [];
    }
  },

  /**
   * ✅ Home/Directory Showcase Data (NO hardcode)
   * Returns:
   * [
   *  { id,name,slug,image_url, subcategories: [
   *     { id,name,slug,image_url, micros:[{id,name,slug}] }
   *  ]}
   * ]
   */
  getHomeShowcaseCategories: async (options = {}) => {
    try {
      const params = new URLSearchParams(options);
      const json = await fetchCategoryJson('/api/dir/categories/home-showcase' + '?' + params.toString());
      return json?.categories || [];
    } catch (err) {
      console.error('Unexpected error fetching showcase categories:', err);
      return [];
    }
  },

  getActiveHeadCategoryCount: async () => {
    try {
      const json = await fetchCategoryJson('/api/dir/categories/head-count');
      return json?.count || 0;
    } catch (err) {
      console.error('Unexpected error counting head categories:', err);
      return 0;
    }
  },

  // ✅ Children fetch (HEAD -> SUB, SUB -> MICRO)
  getCategoryChildren: async (parentId, parentType = 'HEAD') => {
    try {
      const params = new URLSearchParams({ parentId, parentType });
      const json = await fetchCategoryJson('/api/dir/categories/children' + '?' + params.toString());
      return json?.children || [];
    } catch (err) {
      console.error('Unexpected error fetching children:', err);
      return [];
    }
  },

  // ✅ slug resolver
  getCategoryBySlug: async (slug) => {
    try {
      const json = await fetchCategoryJson('/api/dir/category/universal/' + slug);
      return json?.category || null;
    } catch (err) {
      console.error('Unexpected error fetching category by slug:', err);
      return null;
    }
  },

  getCategoryHierarchy: async (slug) => {
    return await categoryApi.getCategoryBySlug(slug);
  },

  seedCategories: async (jsonData) => {
    // Currently relying on edge functions, left as is if not hitting supabase client.
    // Assuming backend will handle this, but for now we leave it stubbed or unchanged
    // to strictly remove direct supabase imports from here.
    const res = await fetch(apiUrl('/api/dir/categories/seed'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonData)
    });
    const json = await readJson(res);
    if (!res.ok) throw new Error(json.error);
    return json.data;
  }
};
