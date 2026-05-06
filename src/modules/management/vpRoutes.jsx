import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
import EmployeeLayout from '@/modules/employee/layouts/EmployeeLayout';

const VpDashboard = lazy(() => import('@/modules/management/vp/pages/Dashboard'));
const TerritoryEngagements = lazy(() => import('@/modules/management/vp/pages/TerritoryEngagements'));
const VpSubscriptionRequests = lazy(() => import('@/modules/management/pages/SubscriptionRequests'));

export const VpRoutes = () => {
  return (
    <Route path="vp" element={<EmployeeLayout allowedRole="VP" />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<VpDashboard />} />
      <Route path="territory" element={<VpDashboard />} />
      <Route path="subscription-requests" element={<VpSubscriptionRequests role="VP" />} />
      <Route path="engagements" element={<TerritoryEngagements />} />
      <Route path="territory-engagements" element={<TerritoryEngagements />} />
    </Route>
  );
};

export default VpRoutes;
