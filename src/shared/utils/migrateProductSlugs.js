/**
 * Migration utility to normalize SEO-friendly slugs for products
 * Run this in browser console or as part of app initialization
 */

import { supabase } from '@/lib/customSupabaseClient';
import { generateUniqueSlug, mergeProductSlugAliases } from '@/shared/utils/slugUtils';

const getProductsBatch = async (from, to) => {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, metadata')
    .order('id', { ascending: true })
    .range(from, to);

  if (error) throw error;
  return data || [];
};

const buildProductNormalizationPayload = async (product) => {
  const normalizedSlug = await generateUniqueSlug(product.name, { excludeId: product.id });
  const currentSlug = String(product?.slug || '').trim();
  const metadata = mergeProductSlugAliases(product?.metadata, currentSlug, normalizedSlug);

  return {
    slug: normalizedSlug,
    metadata,
  };
};

export const migrateProductSlugs = async () => {
  try {
    console.log('🔄 Starting product slug normalization...');

    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, slug, metadata');

    if (fetchError) throw fetchError;

    let updated = 0;
    let failed = 0;

    for (const product of products || []) {
      try {
        const updatePayload = await buildProductNormalizationPayload(product);
        const currentSlug = String(product?.slug || '').trim();
        const currentMetadata = JSON.stringify(product?.metadata || {});
        const nextMetadata = JSON.stringify(updatePayload.metadata || {});

        if (currentSlug === updatePayload.slug && currentMetadata === nextMetadata) {
          continue;
        }

        const { error: updateError } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', product.id);

        if (updateError) {
          console.error(`❌ Failed to update product ${product.id}:`, updateError);
          failed++;
        } else {
          console.log(`✅ Updated product "${product.name}" with slug: ${updatePayload.slug}`);
          updated++;
        }
      } catch (error) {
        console.error(`❌ Error processing product ${product.id}:`, error);
        failed++;
      }
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`❌ Failed: ${failed}`);

    return { success: true, updated, failed };
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

// Alternative: Batch update for better performance
export const migrateProductSlugsBatch = async (batchSize = 50) => {
  try {
    console.log('🔄 Starting batch product slug normalization...');

    let updated = 0;
    let failed = 0;
    let offset = 0;
    let scanned = 0;

    while (true) {
      const batch = await getProductsBatch(offset, offset + batchSize - 1);
      if (!batch || batch.length === 0) break;

      scanned += batch.length;

      for (const product of batch) {
        try {
          const updatePayload = await buildProductNormalizationPayload(product);
          const currentSlug = String(product?.slug || '').trim();
          const currentMetadata = JSON.stringify(product?.metadata || {});
          const nextMetadata = JSON.stringify(updatePayload.metadata || {});

          if (currentSlug === updatePayload.slug && currentMetadata === nextMetadata) {
            continue;
          }

          const { error: updateError } = await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', product.id);

          if (updateError) {
            failed++;
            console.error(`❌ Failed product ${product.id}:`, updateError);
          } else {
            updated++;
          }
        } catch (error) {
          failed++;
          console.error(`❌ Error updating ${product.id}:`, error);
        }
      }

      offset += batch.length;
      console.log(`📊 Progress: ${updated} updated, ${failed} failed, ${scanned} scanned`);
    }

    console.log(`\n🎉 Batch migration complete!`);
    console.log(`✅ Total Updated: ${updated}`);
    console.log(`❌ Total Failed: ${failed}`);

    return { success: true, updated, failed };
  } catch (error) {
    console.error('Batch migration failed:', error);
    throw error;
  }
};
