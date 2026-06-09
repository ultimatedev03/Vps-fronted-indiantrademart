import React from 'react';
import Search360Workspace from '@/shared/components/Search360Workspace';
import { adminApi } from '@/modules/admin/services/adminApi';

const AdminSearch360 = () => (
  <Search360Workspace
    api={adminApi.search360}
    title="Search 360"
    description="Admin view for vendor profile, listed products, plan, account status, support cases, and cross-team escalation."
    roleLabel="ADMIN"
  />
);

export default AdminSearch360;
