import React, { lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import VendorPortalLayout from '@/modules/vendor/layouts/PortalLayout';
import { useSubdomain } from '@/contexts/SubdomainContext';

const VendorDashboard = lazy(() => import('@/modules/vendor/pages/Dashboard'));
const VendorProducts = lazy(() => import('@/modules/vendor/pages/Products'));
const VendorProductForm = lazy(() => import('@/modules/vendor/pages/ProductForm'));
const Leads = lazy(() => import('@/modules/vendor/pages/Leads'));
const LeadDetail = lazy(() => import('@/modules/vendor/pages/LeadDetail'));
const Proposals = lazy(() => import('@/modules/vendor/pages/Proposals'));
const VendorMessages = lazy(() => import('@/modules/vendor/pages/Messages'));
const SendQuotation = lazy(() => import('@/modules/vendor/pages/SendQuotation'));
const VendorProfile = lazy(() => import('@/modules/vendor/pages/Profile'));
const VendorSettings = lazy(() => import('@/modules/vendor/pages/Settings'));
const VendorServices = lazy(() => import('@/modules/vendor/pages/Services'));
const VendorSupport = lazy(() => import('@/modules/vendor/pages/Support'));
const VendorSupportTicket = lazy(() => import('@/modules/vendor/pages/SupportTicket'));
const PhotosDocs = lazy(() => import('@/modules/vendor/pages/PhotosDocs'));
const VendorRegister = lazy(() => import('@/modules/vendor/pages/auth/Register'));
const VendorLogin = lazy(() => import('@/modules/vendor/pages/auth/Login'));
const VendorVerify = lazy(() => import('@/modules/vendor/pages/auth/Verify'));
const ForgotPassword = lazy(() => import('@/shared/pages/ForgotPassword'));
const VendorAnalytics = lazy(() => import('@/modules/vendor/pages/Analytics'));
const CoverageSettings = lazy(() => import('@/modules/vendor/pages/CoverageSettings'));
const Collections = lazy(() => import('@/modules/vendor/pages/Collections'));
const VendorReferrals = lazy(() => import('@/modules/vendor/pages/Referrals'));

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import PageStatusWrapper from '@/components/PageStatusWrapper';

const StripPrefixRedirect = ({ prefix, fallback }) => {
  const location = useLocation();
  const trimmedPath = String(location.pathname || '').startsWith(prefix)
    ? String(location.pathname || '').slice(prefix.length)
    : '';
  const nextPath = trimmedPath || fallback;
  const normalizedPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  return <Navigate to={`${normalizedPath}${location.search || ''}${location.hash || ''}`} replace />;
};

export const VendorRoutes = () => {
  const { appType, resolvePath } = useSubdomain();
  const vendorLoginPath = resolvePath('login', 'vendor');
  const vendorProfilePath = `${resolvePath('profile', 'vendor')}?tab=kyc`;

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="login" element={<VendorLogin />} />
      <Route
        path="register"
        element={
          <PageStatusWrapper pageRoute="/vendor/register">
            <VendorRegister />
          </PageStatusWrapper>
        }
      />
      <Route path="verify" element={<VendorVerify />} />
      <Route path="forgot-password" element={<ForgotPassword />} />

      {/* Protected Portal Routes */}
      <Route element={<ProtectedRoute allowedRoles={['VENDOR']} redirectTo={vendorLoginPath} />}>
        <Route
          element={
            <PageStatusWrapper pageRoute="/vendor">
              <VendorPortalLayout />
            </PageStatusWrapper>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<VendorDashboard />} />
          <Route path=":vendorId/dashboard" element={<VendorDashboard />} />

          <Route path="products" element={<VendorProducts />} />
          <Route path="products/add" element={<VendorProductForm />} />
          <Route path="products/:id/edit" element={<VendorProductForm />} />

          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadDetail />} />

          <Route path="proposals" element={<Proposals />} />
          <Route path="messages" element={<VendorMessages />} />
          <Route path="proposals/send" element={<SendQuotation />} />

          <Route path="kyc" element={<Navigate to={vendorProfilePath} replace />} />

          <Route path="support" element={<VendorSupport />} />
          <Route path="support/:id" element={<VendorSupportTicket />} />
          <Route path="profile" element={<VendorProfile />} />
          <Route path="settings" element={<VendorSettings />} />
          <Route path="photos-docs" element={<PhotosDocs />} />
          <Route path="analytics" element={<VendorAnalytics />} />
          <Route path="subscriptions" element={<VendorServices />} />
          <Route path="referrals" element={<VendorReferrals />} />
          <Route path="coverage" element={<CoverageSettings />} />
          <Route path="collections" element={<Collections />} />
        </Route>
      </Route>

      {appType === 'vendor' ? (
        <Route path="vendor/*" element={<StripPrefixRedirect prefix="/vendor" fallback={resolvePath('dashboard', 'vendor')} />} />
      ) : null}

      <Route path="*" element={<Navigate to={vendorLoginPath} replace />} />
    </Routes>
  );
};
