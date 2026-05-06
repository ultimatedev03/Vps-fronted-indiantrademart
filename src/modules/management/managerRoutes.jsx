import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
import EmployeeLayout from '@/modules/employee/layouts/EmployeeLayout';

const ManagerDashboard = lazy(() => import('@/modules/management/manager/pages/Dashboard'));
const TerritoryEngagements = lazy(() => import('@/modules/management/manager/pages/TerritoryEngagements'));
const ManagerPricingApprovals = lazy(() => import('@/modules/management/manager/pages/PricingApprovals'));
const ManagerSubscriptionRequests = lazy(() => import('@/modules/management/pages/SubscriptionRequests'));

export const ManagerRoutes = () => {
  return (
    <Route path="manager" element={<EmployeeLayout allowedRole="MANAGER" />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<ManagerDashboard />} />
      <Route path="territory" element={<ManagerDashboard />} />
      <Route path="pricing-approvals" element={<ManagerPricingApprovals />} />
      <Route path="subscription-requests" element={<ManagerSubscriptionRequests role="MANAGER" />} />
      <Route path="engagements" element={<TerritoryEngagements />} />
      <Route path="territory-engagements" element={<TerritoryEngagements />} />
    </Route>
  );
};

export default ManagerRoutes;
