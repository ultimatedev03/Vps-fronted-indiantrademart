import { supabase } from '@/lib/customSupabaseClient';
import { generateUniqueSlug } from '@/shared/utils/slugUtils';

const getVendorsBatch = async (from, to) => {
  const { data, error } = await supabase
    .from('vendors')
    .select('id, slug, company_name, owner_name, email')
    .order('id', { ascending: true })
    .range(from, to);

  if (error) throw error;
  return data || [];
};

const resolveVendorSlugSource = (vendor = {}) => {
  const companyName = String(vendor?.company_name || '').trim();
  if (companyName) return companyName;

  const ownerName = String(vendor?.owner_name || '').trim();
  if (ownerName) return ownerName;

  const email = String(vendor?.email || '').trim().toLowerCase();
  if (email) return email.split('@')[0] || email;

  return 'vendor';
};

const buildVendorNormalizationPayload = async (vendor) => {
  const nextSlug = await generateUniqueSlug(resolveVendorSlugSource(vendor), {
    table: 'vendors',
    fallback: 'vendor',
    excludeId: vendor.id,
  });

  return { slug: nextSlug };
};

export const migrateVendorSlugsBatch = async (batchSize = 50) => {
  try {
    console.log('🔄 Starting batch vendor slug normalization...');

    let updated = 0;
    let failed = 0;
    let offset = 0;
    let scanned = 0;

    while (true) {
      const batch = await getVendorsBatch(offset, offset + batchSize - 1);
      if (!batch || batch.length === 0) break;

      scanned += batch.length;

      for (const vendor of batch) {
        try {
          const updatePayload = await buildVendorNormalizationPayload(vendor);
          const currentSlug = String(vendor?.slug || '').trim();

          if (currentSlug === updatePayload.slug) {
            continue;
          }

          const { error: updateError } = await supabase
            .from('vendors')
            .update(updatePayload)
            .eq('id', vendor.id);

          if (updateError) {
            failed++;
            console.error(`❌ Failed vendor ${vendor.id}:`, updateError);
          } else {
            updated++;
          }
        } catch (error) {
          failed++;
          console.error(`❌ Error updating vendor ${vendor.id}:`, error);
        }
      }

      offset += batch.length;
      console.log(`📊 Vendor progress: ${updated} updated, ${failed} failed, ${scanned} scanned`);
    }

    console.log('\n🎉 Vendor slug migration complete!');
    console.log(`✅ Total Updated: ${updated}`);
    console.log(`❌ Total Failed: ${failed}`);

    return { success: true, updated, failed };
  } catch (error) {
    console.error('Vendor slug migration failed:', error);
    throw error;
  }
};
