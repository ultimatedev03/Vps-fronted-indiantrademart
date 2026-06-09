import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/shared/components/Card';
import { Star, MapPin, ExternalLink, Loader2, Heart, Building2, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AppAuthContext';
import { buyerApi } from '@/modules/buyer/services/buyerApi';
import {
  productFavorites,
  PRODUCT_FAVORITES_UPDATED_EVENT,
} from '@/modules/buyer/services/productFavorites';
import { getProductDetailPath } from '@/shared/utils/productRoutes';
import { getVendorProfilePath } from '@/shared/utils/vendorRoutes';

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return 'Price on request';
  if (typeof value === 'number' && Number.isFinite(value)) return `Rs ${value.toLocaleString()}`;
  const parsed = Number(String(value).replace(/[^0-9.]/g, '').trim());
  if (!Number.isFinite(parsed)) return String(value);
  return `Rs ${parsed.toLocaleString()}`;
};

const VENDOR_FAVORITES_UPDATED_EVENT = 'itm:favorite-vendors:updated';

const getVendor = (favorite) => favorite?.vendors || favorite?.vendor || {};
const dedupeVendorFavorites = (items = []) => {
  const byVendorId = new Map();
  (Array.isArray(items) ? items : []).forEach((fav) => {
    const key = String(fav?.vendor_id || getVendor(fav)?.id || '').trim();
    if (!key || byVendorId.has(key)) return;
    byVendorId.set(key, fav);
  });
  return Array.from(byVendorId.values());
};

const Favorites = () => {
  const { user, profile, buyerId } = useAuth();
  const [serviceFavorites, setServiceFavorites] = useState([]);
  const [vendorFavorites, setVendorFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const favoriteKeys = useMemo(
    () =>
      [user?.id, buyerId, profile?.id, profile?.user_id, user?.email, profile?.email]
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    [buyerId, profile?.email, profile?.id, profile?.user_id, user?.email, user?.id]
  );

  useEffect(() => {
    if (!user?.id) {
      setServiceFavorites([]);
      setVendorFavorites([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const services = productFavorites.listForKeys(favoriteKeys);
      let companies = [];

      try {
        companies = await buyerApi.getFavorites();
      } catch (error) {
        console.error('[BuyerFavorites] company favorites load failed:', error);
      }

      if (cancelled) return;
      setServiceFavorites(services);
      setVendorFavorites(dedupeVendorFavorites(companies));
      setLoading(false);
    };

    setLoading(true);
    refresh();
    window.addEventListener(PRODUCT_FAVORITES_UPDATED_EVENT, refresh);
    window.addEventListener(VENDOR_FAVORITES_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);

    return () => {
      cancelled = true;
      window.removeEventListener(PRODUCT_FAVORITES_UPDATED_EVENT, refresh);
      window.removeEventListener(VENDOR_FAVORITES_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [favoriteKeys, user?.id]);

  const handleRemoveFavorite = (productId) => {
    if (!user?.id) return;
    const next = productFavorites.removeForKeys(favoriteKeys, productId);
    setServiceFavorites(next);
  };

  const handleRemoveVendorFavorite = async (vendorId) => {
    if (!user?.id || !vendorId) return;
    setVendorFavorites((prev) => prev.filter((fav) => String(fav?.vendor_id) !== String(vendorId)));
    try {
      await buyerApi.removeFavorite(vendorId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(VENDOR_FAVORITES_UPDATED_EVENT));
      }
    } catch (error) {
      console.error('[BuyerFavorites] company favorite remove failed:', error);
      const companies = await buyerApi.getFavorites().catch(() => []);
      setVendorFavorites(dedupeVendorFavorites(companies));
    }
  };

  const hasFavorites = serviceFavorites.length > 0 || vendorFavorites.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-bold text-gray-900">Saved Favorites</h1>
            <p className="text-gray-500">Companies and services you marked as favorite</p>
         </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
           <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : !hasFavorites ? (
        <Card className="bg-gray-50 border-dashed border-2 p-10 flex flex-col items-center justify-center text-center">
           <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
              <Star className="h-8 w-8 text-gray-400" />
           </div>
           <h3 className="text-lg font-semibold text-gray-900">No Favorites Yet</h3>
           <p className="text-gray-500 mb-6 max-w-md">Save companies or services from the directory and they will appear here.</p>
           <Link to="/directory">
              <Button>Browse Directory</Button>
           </Link>
        </Card>
      ) : (
        <div className="space-y-8">
          {vendorFavorites.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-bold text-gray-900">Saved Companies</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vendorFavorites.map((fav) => {
                  const vendor = getVendor(fav);
                  const vendorId = fav.vendor_id || vendor.id;
                  const vendorName = vendor.company_name || vendor.owner_name || 'Company';
                  const location = [vendor.city, vendor.state].filter(Boolean).join(', ');
                  const vendorPath = getVendorProfilePath(vendor);
                  const logo = vendor.profile_image || vendor.avatar_url;

                  return (
                    <Card key={fav.id || vendorId} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50">
                            {logo ? (
                              <img src={logo} alt={vendorName} className="h-full w-full object-cover" />
                            ) : (
                              <Building2 className="h-8 w-8 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="flex items-center gap-1.5 font-bold text-gray-900 line-clamp-2">
                              {vendorName}
                              {vendor.verification_badge ? (
                                <BadgeCheck className="h-4 w-4 shrink-0 fill-blue-500 text-white" />
                              ) : null}
                            </h3>
                            {location && (
                              <div className="mt-2 flex items-center text-sm text-gray-500">
                                <MapPin className="mr-1 h-3 w-3 shrink-0" /> {location}
                              </div>
                            )}
                            {Number(vendor.seller_rating || 0) > 0 && (
                              <div className="mt-2 inline-flex items-center gap-1 text-sm text-gray-600">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                {Number(vendor.seller_rating).toFixed(1)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          {vendorPath ? (
                            <Link to={vendorPath} className="flex-1 min-w-[140px]">
                              <Button variant="outline" className="w-full h-9 text-xs">
                                View Company <ExternalLink className="h-3 w-3 ml-2" />
                              </Button>
                            </Link>
                          ) : null}
                          <Button
                            variant="outline"
                            className="h-9 flex-1 min-w-[140px] text-xs text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveVendorFavorite(vendorId)}
                          >
                            Remove
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {serviceFavorites.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-bold text-gray-900">Saved Services</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceFavorites.map((fav) => {
            const location = [fav.vendorCity, fav.vendorState].filter(Boolean).join(', ');
            const productPath = getProductDetailPath(fav) || '/directory';
            const vendorPath = getVendorProfilePath({
              slug: fav.vendorSlug,
              id: fav.vendorId,
            });

            return (
              <Card key={fav.productId} className="overflow-hidden hover:shadow-md transition-shadow group">
                <div className="h-36 bg-gray-100 relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                   {fav.image ? (
                    <img src={fav.image} alt={fav.name} className="w-full h-full object-cover" />
                   ) : (
                    <span className="text-4xl font-bold text-blue-200">{fav.name?.charAt(0) || 'S'}</span>
                   )}
                   
                   <button 
                     onClick={() => handleRemoveFavorite(fav.productId)}
                     className="absolute top-2 right-2 p-2 bg-white/90 rounded-full text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                     title="Remove from favorites"
                   >
                     <Heart className="h-4 w-4 fill-current" />
                   </button>
                </div>
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                     <div>
                        <h3 className="font-bold text-lg text-gray-900 line-clamp-2">{fav.name}</h3>
                        <p className="text-sm font-semibold text-[#008B7A] mt-1">{formatPrice(fav.price)}</p>
                        <div className="text-sm text-gray-600 mt-1 line-clamp-1">
                          {fav.vendorName || 'Vendor'}
                        </div>
                        {location && (
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <MapPin className="h-3 w-3 mr-1" /> {location}
                          </div>
                        )}
                     </div>
                  </div>
                  
                  <div className="flex gap-3 mt-4 flex-wrap">
                     <Link to={productPath} className="flex-1 min-w-[140px]">
                        <Button variant="outline" className="w-full h-9 text-xs">
                          View Service <ExternalLink className="h-3 w-3 ml-2" />
                        </Button>
                     </Link>
                     {vendorPath ? (
                      <Link to={vendorPath} className="flex-1 min-w-[140px]">
                        <Button variant="outline" className="w-full h-9 text-xs">
                          View Profile <ExternalLink className="h-3 w-3 ml-2" />
                        </Button>
                      </Link>
                     ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default Favorites;
