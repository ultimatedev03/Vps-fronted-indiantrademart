import React, { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import EmployeeLayout from '@/modules/employee/layouts/EmployeeLayout';
import { ManagerRoutes } from '@/modules/management/managerRoutes';
import { VpRoutes } from '@/modules/management/vpRoutes';

const EmployeeLogin = lazy(() => import('@/modules/employee/pages/auth/Login'));
const DataEntryDashboard = lazy(() => import('@/modules/employee/pages/dataentry/Dashboard'));
const DataEntryLocations = lazy(() => import('@/modules/employee/pages/dataentry/LocationsFixed'));
const DataEntryVendors = lazy(() => import('@/modules/employee/pages/dataentry/Vendors'));
const DataEntryVendorProducts = lazy(() => import('@/modules/employee/pages/dataentry/VendorProducts'));
const DataEntryAddProduct = lazy(() => import('@/modules/employee/pages/dataentry/AddProduct'));
const DataEntryCategories = lazy(() => import('@/modules/employee/pages/dataentry/CategoriesFixed'));
const DataEntryCsvUpload = lazy(() => import('@/modules/employee/pages/dataentry/CsvUpload'));
const DataEntryVendorOnboarding = lazy(() => import('@/modules/employee/pages/dataentry/VendorOnboarding'));
const DataEntryRecords = lazy(() => import('@/modules/employee/pages/dataentry/DataEntryRecords'));
const KycApprovals = lazy(() => import('@/modules/employee/pages/support/KycApprovals'));
const SupportDashboard = lazy(() => import('@/modules/employee/pages/support/Dashboard'));
const SupportTickets = lazy(() => import('@/modules/employee/pages/support/Tickets'));
const SalesDashboard = lazy(() => import('@/modules/employee/pages/sales/Dashboard'));
const SalesLeads = lazy(() => import('@/modules/employee/pages/sales/Leads'));
const PricingRules = lazy(() => import('@/modules/employee/pages/sales/PricingRules'));
const TerritoryEngagements = lazy(() => import('@/modules/employee/pages/territory/TerritoryEngagements'));

export const EmployeeRoutes = () => {
  return (
    <Routes>
      <Route path="login" element={<EmployeeLogin />} />
      <Route path="manager/login" element={<EmployeeLogin forcedPortalKey="manager" />} />
      <Route path="vp/login" element={<EmployeeLogin forcedPortalKey="vp" />} />

      <Route path="dataentry" element={<EmployeeLayout allowedRole="DATA_ENTRY" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DataEntryDashboard />} />
        <Route path="categories" element={<DataEntryCategories />} />
        <Route path="categories/upload" element={<DataEntryCsvUpload />} />
        <Route path="locations" element={<DataEntryLocations />} />
        <Route path="vendor-onboarding" element={<DataEntryVendorOnboarding />} />
        <Route path="records" element={<DataEntryRecords />} />
        <Route path="vendors" element={<DataEntryVendors />} />
        <Route path="vendors/:vendorId" element={<DataEntryVendorProducts />} />
        <Route path="vendors/:vendorId/products" element={<DataEntryVendorProducts />} />
        <Route path="vendors/:vendorId/products/add" element={<DataEntryAddProduct />} />
        <Route path="vendors/:vendorId/products/:productId/edit" element={<DataEntryAddProduct />} />
        <Route path="kyc-review" element={<KycApprovals />} />
        <Route path="kyc" element={<KycApprovals />} />
      </Route>

      <Route path="support" element={<EmployeeLayout allowedRole="SUPPORT" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SupportDashboard />} />
        <Route path="kyc-review" element={<KycApprovals />} />
        <Route path="kyc" element={<KycApprovals />} />
        <Route path="tickets" element={<SupportTickets />} />
        <Route path="tickets/vendor" element={<SupportTickets />} />
        <Route path="tickets/buyer" element={<SupportTickets />} />
      </Route>

      <Route path="sales" element={<EmployeeLayout allowedRole="SALES" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SalesDashboard />} />
        <Route path="leads" element={<SalesLeads />} />
        <Route path="pricing-rules" element={<PricingRules />} />
        <Route path="territory-engagements" element={<TerritoryEngagements />} />
      </Route>

      {ManagerRoutes()}
      {VpRoutes()}

      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
};

export default EmployeeRoutes;
