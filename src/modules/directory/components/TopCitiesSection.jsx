import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { directoryApi } from '@/modules/directory/services/directoryApi';

const DESIRED_CITIES = [
  'Delhi',
  'Noida',
  'Mumbai',
  'Bangaluru',
  'Chennai',
  'Kolkata',
  'Jaipur',
  'Ahmedabad',
  'Hyderabad',
  'Lucknow',
];

const buildPlaceholderCities = () =>
  DESIRED_CITIES.map((name) => ({
    id: `placeholder-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    slug: name
      .toLowerCase()
      .trim()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''),
    supplier_count: 0,
  }));

const TopCitiesSection = () => {
  const navigate = useNavigate();
  const [cities, setCities] = useState(buildPlaceholderCities);

  const slugify = (text = '') =>
    text
      .toLowerCase()
      .trim()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const normalize = (name = '') =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');

  useEffect(() => {
    const loadCities = async () => {
      const data = await directoryApi.getTopCities(25);

      const aliasMap = {
        delhi: ['delhi', 'new delhi', 'ncr delhi'],
        noida: ['noida'],
        mumbai: ['mumbai', 'bombay'],
        bangaluru: ['bengaluru', 'bangalore', 'bangaluru'],
        chennai: ['chennai', 'madras'],
        kolkata: ['kolkata', 'calcutta'],
        jaipur: ['jaipur'],
        ahmedabad: ['ahmedabad', 'ahmedavad'],
        hyderabad: ['hyderabad'],
        lucknow: ['lucknow'],
      };

      const raw = Array.isArray(data) ? data : [];
      const usedIds = new Set();

      const findCityInData = (wantedKey) => {
        const wantedAliases = aliasMap[wantedKey] || [wantedKey];
        const normalizedAliases = wantedAliases.map((item) => normalize(item));

        for (const city of raw) {
          if (!city || usedIds.has(city.id)) continue;
          const normalizedName = normalize(city.name || '');
          if (normalizedAliases.some((alias) => normalizedName.includes(alias))) {
            return city;
          }
        }

        return null;
      };

      const finalCities = DESIRED_CITIES.map((desiredName) => {
        const desiredKey = normalize(desiredName);
        const found = findCityInData(desiredKey);

        if (found) {
          usedIds.add(found.id);
          return found;
        }

        return {
          id: `custom-${slugify(desiredName)}`,
          name: desiredName,
          slug: slugify(desiredName),
          supplier_count: 0,
        };
      });

      setCities(finalCities);
    };

    loadCities();
  }, []);

  const formatCount = (num) => {
    const n = Number(num || 0);
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`;
    return `${n}+`;
  };

  const CityIcon = ({ city }) => {
    const name = (city?.name || '').toLowerCase();
    const CityImg = (props) => <img loading="lazy" decoding="async" width="80" height="80" sizes="80px" {...props} />;

    if (name.includes('delhi')) {
      return (
        <CityImg
          alt="Delhi"
          className="w-full h-full rounded-full object-cover"
          src="https://images.unsplash.com/photo-1703083664356-a15a04d42e4c?auto=format&fit=crop&w=200&q=60"
        />
      );
    }

    if (name.includes('noida')) {
      return (
        <CityImg
          alt="Noida"
          className="w-full h-full rounded-full object-cover"
          src="https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=200&q=60"
        />
      );
    }

    if (name.includes('mumbai')) {
      return (
        <CityImg
          alt="Mumbai"
          className="w-full h-full rounded-full object-cover"
          src="https://images.unsplash.com/photo-1518918249916-0a72d4f98658?auto=format&fit=crop&w=200&q=60"
        />
      );
    }

    if (name.includes('bengaluru') || name.includes('bangalore') || name.includes('bangaluru')) {
      return (
        <CityImg
          alt="Bengaluru"
          className="w-full h-full rounded-full object-cover"
          src="https://images.unsplash.com/photo-1698127091046-3e260f65d6d8?auto=format&fit=crop&w=200&q=60"
        />
      );
    }

    if (name.includes('chennai')) {
      return (
        <CityImg
          alt="Chennai"
          className="w-full h-full rounded-full object-cover"
          src="https://images.unsplash.com/photo-1635472276754-a5369ebf1bba?auto=format&fit=crop&w=200&q=60"
        />
      );
    }

    if (name.includes('kolkata')) {
      return (
        <CityImg
          alt="Kolkata"
          className="w-full h-full rounded-full object-cover"
          src="https://images.unsplash.com/photo-1571481808344-77708908c5a9?auto=format&fit=crop&w=200&q=60"
        />
      );
    }

    if (name.includes('jaipur')) {
      return (
        <CityImg
          alt="Jaipur"
          className="w-full h-full rounded-full object-cover"
          src="https://images.unsplash.com/photo-1617516203158-1b87bb39caa7?auto=format&fit=crop&w=200&q=60"
        />
      );
    }

    if (name.includes('ahmedabad')) {
      return (
        <CityImg
          alt="Ahmedabad"
          className="w-full h-full rounded-full object-cover"
          src="https://images.unsplash.com/photo-1674783358278-bed2d6a4d57d?auto=format&fit=crop&w=200&q=60"
        />
      );
    }

    if (name.includes('hyderabad')) {
      return (
        <CityImg
          alt="Hyderabad"
          className="w-full h-full rounded-full object-cover"
          src="https://images.unsplash.com/photo-1610341940372-5aab4d3786cb?auto=format&fit=crop&w=200&q=60"
        />
      );
    }

    return <MapPin className="w-8 h-8 text-gray-400" strokeWidth={1.5} />;
  };

  return (
    <section className="py-16 bg-white min-h-[520px]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Find Suppliers from Top Cities</h2>
          <p className="text-gray-500 text-lg">Connect with verified suppliers across India's major business hubs</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-8 mb-10">
          {cities.map((city) => (
            <div
              key={city.id}
              onClick={() => navigate(`/directory/city/${city.slug}`)}
              className="group mx-auto flex aspect-square w-full max-w-[165px] cursor-pointer flex-col items-center justify-center rounded-full border border-gray-100 bg-white px-4 py-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-lg"
              title={city.name}
            >
              <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-gray-50 shadow-sm ring-4 ring-gray-50 transition-all group-hover:bg-blue-50 group-hover:ring-blue-50">
                <CityIcon city={city} />
              </div>
              <h3 className="text-center text-base font-bold leading-tight text-gray-900 transition-colors group-hover:text-blue-700">
                {city.name}
              </h3>
              <p className="mt-1 text-center text-xs font-medium text-gray-500">{formatCount(city.supplier_count)} suppliers</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            onClick={() => navigate('/directory/cities')}
            className="bg-[#4F46E5] hover:bg-[#4338ca] text-white px-8 h-12 rounded-lg font-medium shadow-md shadow-blue-200"
          >
            View All Cities <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default TopCitiesSection;
