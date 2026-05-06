
import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSubdomain } from '@/contexts/SubdomainContext';

const Categories = () => {
  const navigate = useNavigate();
  const { resolvePath } = useSubdomain();
  return (
    <div className="p-6 text-center bg-white rounded-lg border border-neutral-200">
        <h2 className="text-xl font-bold mb-2 text-neutral-800">Category Management Disabled</h2>
        <p className="text-neutral-500 mb-4">This module has been removed.</p>
        <Button onClick={() => navigate(resolvePath('dashboard', 'admin'))}>Go to Dashboard</Button>
    </div>
  );
};

export default Categories;
