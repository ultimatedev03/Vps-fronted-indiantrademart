import React from 'react';
import Search360Workspace from '@/shared/components/Search360Workspace';
import { search360Api } from '@/modules/employee/services/search360Api';
import { useEmployeeAuth } from '@/modules/employee/context/EmployeeAuthContext';

const Search360Page = () => {
  const { user } = useEmployeeAuth();
  const role = String(user?.role || '').replace('_', ' ');

  return (
    <Search360Workspace
      api={search360Api}
      title="Search 360"
      description="Vendor profile, products, plan, account status, support tickets, and escalation history in one workspace."
      roleLabel={role}
    />
  );
};

export default Search360Page;
