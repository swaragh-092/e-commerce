import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';


// Layouts
import StoreLayout from '../layouts/StoreLayout';
import AdminLayout from '../layouts/AdminLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Storefront pages
const LoginPage = lazy(() => import('../pages/storefront/LoginPage'));
const RegisterPage = lazy(() => import('../pages/storefront/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/storefront/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/storefront/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('../pages/storefront/VerifyEmailPage'));
const AccountPage = lazy(() => import('../pages/storefront/AccountPage'));
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
const DashboardPage = lazy(() => import('../pages/admin/DashboardPage'));
const ProductsManagePage = lazy(() => import('../pages/admin/ProductsManagePage'));
const ProductEditPage = lazy(() => import('../pages/admin/ProductEditPage'));
const CategoriesPage = lazy(() => import('../pages/admin/CategoriesPage'));
const OrdersManagePage = lazy(() => import('../pages/admin/OrdersManagePage'));
const OrderDetailPage = lazy(() => import('../pages/admin/OrderDetailPage'));
const CustomersPage = lazy(() => import('../pages/admin/CustomersPage'));
const CouponsPage = lazy(() => import('../pages/admin/CouponsPage'));
const ReviewsPage = lazy(() => import('../pages/admin/ReviewsPage'));
const MediaPage = lazy(() => import('../pages/admin/MediaPage'));
const SettingsPage = lazy(() => import('../pages/admin/SettingsPage'));
const AuditLogPage = lazy(() => import('../pages/admin/AuditLogPage'));
const AttributesPage = lazy(() => import('../pages/admin/AttributesPage'));

const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
    <CircularProgress />
  </Box>
);


const Home = () => <HomePage />;

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

      {/* Admin Routes — role-gated */}
      <Route path="/admin" element={<ProtectedRoute role="admin" />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsManagePage />} />
          <Route path="products/new" element={<ProductEditPage />} />
          <Route path="products/:id/edit" element={<ProductEditPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="attributes" element={<AttributesPage />} />
          <Route path="orders" element={<OrdersManagePage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="media" element={<MediaPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit-log" element={<AuditLogPage />} />
        </Route>
      </Route>
    </Routes>
  </Suspense>
);


export default AppRoutes;
