import { apiUrl } from '@/lib/apiBase';

export const categoryApi = {
  // ✅ Fetch top-level categories (Head Categories)
  getTopLevelCategories: async () => {
    try {
      const res = await fetch(apiUrl('/api/dir/categories/top-level'));
      const json = await res.json();
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
      const res = await fetch(apiUrl('/api/dir/categories/home-showcase') + '?' + params.toString());
      const json = await res.json();
      return json?.categories || [];
    } catch (err) {
      console.error('Unexpected error fetching showcase categories:', err);
      return [];
    }
  },

  getActiveHeadCategoryCount: async () => {
    try {
      const res = await fetch(apiUrl('/api/dir/categories/head-count'));
      const json = await res.json();
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
      const res = await fetch(apiUrl('/api/dir/categories/children') + '?' + params.toString());
      const json = await res.json();
      return json?.children || [];
    } catch (err) {
      console.error('Unexpected error fetching children:', err);
      return [];
    }
  },

  // ✅ slug resolver
  getCategoryBySlug: async (slug) => {
    try {
      const res = await fetch(apiUrl('/api/dir/category/universal/' + slug));
      const json = await res.json();
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
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json.data;
  }
};
