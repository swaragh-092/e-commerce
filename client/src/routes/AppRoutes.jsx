import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';


// Layouts
import StoreLayout from '../layouts/StoreLayout';
import AdminLayout from '../layouts/AdminLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { ADMIN_ACCESS_PERMISSIONS, PERMISSIONS, getFirstAccessibleAdminPath } from '../utils/permissions';
import { useAuth } from '../hooks/useAuth';

// Storefront pages
const LoginPage = lazy(() => import('../pages/storefront/LoginPage'));
const RegisterPage = lazy(() => import('../pages/storefront/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/storefront/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/storefront/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('../pages/storefront/VerifyEmailPage'));
const AccountPage = lazy(() => import('../pages/storefront/AccountPage'));
const AllOrdersPage = lazy(() => import('../pages/storefront/AllOrdersPage/index'));
const StoreOrderDetailPage = lazy(() => import('../pages/storefront/OrderDetailPage'));
const StorefrontOrderInvoicePage = lazy(() => import('../pages/storefront/OrderInvoicePage'));
const WishlistPage = lazy(() => import('../pages/storefront/WishlistPage'));
const ProductDetailPage = lazy(() => import('../pages/storefront/ProductDetailPage'));
const ProductListPage = lazy(() => import('../pages/storefront/ProductListPage'));
const CartPage = lazy(() => import('../pages/storefront/CartPage'));
const CheckoutPage = lazy(() => import('../pages/storefront/CheckoutPage'));
const PaymentPage = lazy(() => import('../pages/storefront/PaymentPage'));
const PaymentSuccessPage = lazy(() => import('../pages/storefront/PaymentSuccessPage'));
const PaymentFailurePage = lazy(() => import('../pages/storefront/PaymentFailurePage'));
const HomePage = lazy(() => import('../pages/storefront/HomePage'));
const NotFoundPage = lazy(() => import('../pages/storefront/NotFoundPage'));

// Admin pages
const AdminLoginPage = lazy(() => import('../pages/admin/AdminLoginPage'));
const DashboardPage = lazy(() => import('../pages/admin/DashboardPage'));
const ProductsManagePage = lazy(() => import('../pages/admin/ProductsManagePage'));
const ProductEditPage = lazy(() => import('../pages/admin/ProductEditPage'));
const CategoriesPage = lazy(() => import('../pages/admin/CategoriesPage'));
const OrdersManagePage = lazy(() => import('../pages/admin/OrdersManagePage'));
const OrderDetailPage = lazy(() => import('../pages/admin/OrderDetailPage'));
const OrderInvoicePage = lazy(() => import('../pages/admin/OrderInvoicePage'));
const CustomersPage = lazy(() => import('../pages/admin/CustomersPage'));
const CouponsPage = lazy(() => import('../pages/admin/CouponsPage'));
const ReviewsPage = lazy(() => import('../pages/admin/ReviewsPage'));
const MediaPage = lazy(() => import('../pages/admin/MediaPage'));
const SettingsPage = lazy(() => import('../pages/admin/SettingsPage'));
const PaymentGatewaysPage = lazy(() => import('../pages/admin/PaymentGatewaysPage'));
const ShippingPage = lazy(() => import('../pages/admin/ShippingPage'));
const SaleLabelsPage = lazy(() => import('../pages/admin/SaleLabelsPage'));
const EnquiriesPage = lazy(() => import('../pages/admin/EnquiriesPage'));
const AuditLogPage = lazy(() => import('../pages/admin/AuditLogPage'));
const AttributesPage = lazy(() => import('../pages/admin/AttributesPage'));
const BrandsPage = lazy(() => import('../pages/admin/BrandsPage'));
const AccessControlPage = lazy(() => import('../pages/admin/AccessControlPage'));
const PagesManagePage = lazy(() => import('../pages/admin/PagesManagePage'));
const PageEditPage = lazy(() => import('../pages/admin/PageEditPage'));
const SeoOverridesPage = lazy(() => import('../pages/admin/SeoOverridesPage'));
const EmailTemplatesPage = lazy(() => import('../pages/admin/EmailTemplatesPage'));
const StaticPageView = lazy(() => import('../pages/storefront/StaticPageView'));

const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
    <CircularProgress />
  </Box>
);


const Home = () => <HomePage />;

const AdminIndex = () => {
  const { user, hasPermission } = useAuth();

  if (hasPermission(PERMISSIONS.DASHBOARD_VIEW)) {
    return <DashboardPage />;
  }

  const adminEntryPath = getFirstAccessibleAdminPath(user);
  if (adminEntryPath && adminEntryPath !== '/admin') {
    return <Navigate to={adminEntryPath} replace />;
  }

  return <Navigate to="/" replace />;
};

const AppRoutes = () => (
  <Suspense fallback={<LoadingFallback />}>
    <Routes>
      {/* Storefront Routes */}
      <Route path="/" element={<StoreLayout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/:slug" element={<ProductDetailPage />} />
        <Route path="product/:slug" element={<ProductDetailPage />} />
        <Route path="category/:categorySlug" element={<ProductListPage />} />
        <Route path="p/:slug" element={<StaticPageView />} />
        <Route path="cart" element={<CartPage />} />

        {/* Auth */}
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />

        {/* Protected Storefront */}
        <Route element={<ProtectedRoute />}>
          <Route path="account" element={<AccountPage />} />
          <Route path="account/orders/:id" element={<StoreOrderDetailPage />} />
          <Route path="account/orders/:id/invoice" element={<StorefrontOrderInvoicePage />} />
          <Route path="orders" element={<AllOrdersPage />} />
          <Route path="profile" element={<AccountPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="payment/:orderId" element={<PaymentPage />} />
          <Route path="payment/success" element={<PaymentSuccessPage />} />
          <Route path="payment/failure" element={<PaymentFailurePage />} />
        </Route>

        {/* 404 catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Admin Login Route */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Admin Routes — permission-gated foundation */}
      <Route path="/admin" element={<ProtectedRoute permissions={ADMIN_ACCESS_PERMISSIONS} />}>
        {/* Standalone pages without AdminLayout */}
        <Route element={<ProtectedRoute permission={PERMISSIONS.ORDERS_READ} />}>
          <Route path="orders/:id/invoice" element={<OrderInvoicePage />} />
        </Route>

        <Route element={<AdminLayout />}>
          <Route index element={<AdminIndex />} />
          <Route element={<ProtectedRoute permission={PERMISSIONS.PRODUCTS_READ} />}>
            <Route path="products" element={<ProductsManagePage />} />
            <Route path="brands" element={<BrandsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.PRODUCTS_CREATE} />}>
            <Route path="products/new" element={<ProductEditPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.PRODUCTS_UPDATE} />}>
            <Route path="products/:id/edit" element={<ProductEditPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.CATEGORIES_READ} />}>
            <Route path="categories" element={<CategoriesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.ATTRIBUTES_READ} />}>
            <Route path="attributes" element={<AttributesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.ORDERS_READ} />}>
            <Route path="orders" element={<OrdersManagePage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.CUSTOMERS_READ} />}>
            <Route path="customers" element={<CustomersPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.COUPONS_READ} />}>
            <Route path="coupons" element={<CouponsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.ENQUIRIES_READ} />}>
            <Route path="enquiries" element={<EnquiriesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.REVIEWS_READ} />}>
            <Route path="reviews" element={<ReviewsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.MEDIA_READ} />}>
            <Route path="media" element={<MediaPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.SETTINGS_READ} />}>
            <Route path="settings" element={<SettingsPage />} />
            <Route path="seo-overrides" element={<SeoOverridesPage />} />
            <Route path="payment-gateways" element={<PaymentGatewaysPage />} />
            <Route path="shipping" element={<ShippingPage />} />
            <Route path="sale-labels" element={<SaleLabelsPage />} />
            <Route path="email-templates" element={<EmailTemplatesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.AUDIT_READ} />}>
            <Route path="audit-log" element={<AuditLogPage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.PAGES_READ} />}>
            <Route path="pages" element={<PagesManagePage />} />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.PAGES_MANAGE} />}>
            <Route path="pages/new" element={<PageEditPage />} />
            <Route path="pages/:id/edit" element={<PageEditPage />} />
          </Route>
          <Route
            path="access-control"
            element={(
              <ProtectedRoute
                permissions={[
                  PERMISSIONS.ROLES_READ,
                  PERMISSIONS.ROLES_MANAGE,
                  PERMISSIONS.SYSTEM_ROLES_MANAGE,
                  PERMISSIONS.USERS_ASSIGN_ROLES,
                ]}
              />
            )}
          >
            <Route index element={<AccessControlPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  </Suspense>
);


export default AppRoutes;
