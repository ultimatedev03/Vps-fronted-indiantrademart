import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/shared/components/Card';
import { Star, MapPin, ExternalLink, Loader2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
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

const Favorites = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    const refresh = () => {
      setFavorites(productFavorites.list(user.id));
      setLoading(false);
    };

    setLoading(true);
    refresh();
    window.addEventListener(PRODUCT_FAVORITES_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);

    return () => {
      window.removeEventListener(PRODUCT_FAVORITES_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [user?.id]);

  const handleRemoveFavorite = (productId) => {
    if (!user?.id) return;
    const next = productFavorites.remove(user.id, productId);
    setFavorites(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-bold text-gray-900">Saved Services</h1>
            <p className="text-gray-500">Only the products/services you individually marked as favorite</p>
         </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
           <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : favorites.length === 0 ? (
        <Card className="bg-gray-50 border-dashed border-2 p-10 flex flex-col items-center justify-center text-center">
           <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
              <Star className="h-8 w-8 text-gray-400" />
           </div>
           <h3 className="text-lg font-semibold text-gray-900">No Favorites Yet</h3>
           <p className="text-gray-500 mb-6 max-w-sm">Open any service detail page and click Add to Favorites to save that exact item here.</p>
           <Link to="/directory">
              <Button>Browse Directory</Button>
           </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((fav) => {
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
      )}
    </div>
  );
};

export default Favorites;
