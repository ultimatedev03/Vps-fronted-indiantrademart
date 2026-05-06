import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/react-slider';
import Card from '@/shared/components/Card';

const DEFAULT_MIN_PRICE = 0;
const DEFAULT_MAX_PRICE = 100000;

const getSliderStep = (minValue, maxValue) => {
  const span = Math.max(0, Number(maxValue || 0) - Number(minValue || 0));
  if (span <= 200) return 1;
  if (span <= 2000) return 10;
  if (span <= 20000) return 100;
  return 1000;
};

const SearchFilters = ({ filters, setFilters, priceBounds }) => {
  const minPrice = Number.isFinite(priceBounds?.min) ? Number(priceBounds.min) : DEFAULT_MIN_PRICE;
  const rawMaxPrice = Number.isFinite(priceBounds?.max) ? Number(priceBounds.max) : DEFAULT_MAX_PRICE;
  const maxPrice = rawMaxPrice > minPrice ? rawMaxPrice : minPrice + 1;
  const sliderStep = getSliderStep(minPrice, maxPrice);

  const currentRange =
    Array.isArray(filters?.priceRange) && filters.priceRange.length === 2
      ? filters.priceRange
      : [minPrice, maxPrice];

  const safeMin = Math.max(minPrice, Math.min(Number(currentRange[0]) || minPrice, maxPrice));
  const safeMax = Math.max(safeMin, Math.min(Number(currentRange[1]) || maxPrice, maxPrice));
  const safeRange = [safeMin, safeMax];

  const handleReset = () => {
    setFilters((prev) => ({
      ...prev,
      priceRange: [minPrice, maxPrice],
      rating: 0,
      verified: false,
      inStock: false,
    }));
  };

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-[#003D82]" />
            <Card.Title>Filters</Card.Title>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-[#00A699] hover:text-[#00857A]"
          >
            <X className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </Card.Header>

      <Card.Content className="space-y-6">
        <div>
          <Label className="text-sm font-semibold mb-3 block">Price Range</Label>
          <Slider
            value={safeRange}
            onValueChange={(value) => {
              const nextMin = Math.max(minPrice, Math.min(value?.[0] ?? minPrice, maxPrice));
              const nextMax = Math.max(nextMin, Math.min(value?.[1] ?? maxPrice, maxPrice));
              setFilters((prev) => ({ ...prev, priceRange: [nextMin, nextMax] }));
            }}
            min={minPrice}
            max={maxPrice}
            step={sliderStep}
            className="mb-2"
          />
          <div className="flex justify-between text-sm text-neutral-600">
            <span>Rs {safeRange[0].toLocaleString()}</span>
            <span>Rs {safeRange[1].toLocaleString()}</span>
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold mb-3 block">Minimum Rating</Label>
          <div className="space-y-2">
            {[4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center space-x-2">
                <Checkbox
                  id={`rating-${rating}`}
                  checked={filters.rating === rating}
                  onCheckedChange={(checked) =>
                    setFilters((prev) => ({ ...prev, rating: checked ? rating : 0 }))
                  }
                />
                <label htmlFor={`rating-${rating}`} className="text-sm cursor-pointer">
                  {rating}* & above
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold mb-3 block">Supplier Status</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="verified"
                checked={filters.verified}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({ ...prev, verified: checked === true }))
                }
              />
              <label htmlFor="verified" className="text-sm cursor-pointer">
                Verified Suppliers Only
              </label>
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
};

export default SearchFilters;
