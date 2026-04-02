import { Routes, Route } from 'react-router-dom';

// Layouts
import StoreLayout from '../layouts/StoreLayout';
import AdminLayout from '../layouts/AdminLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Example Pages (To be created)
import LoginPage from '../pages/storefront/LoginPage';
import RegisterPage from '../pages/storefront/RegisterPage';
import ForgotPasswordPage from '../pages/storefront/ForgotPasswordPage';
import ResetPasswordPage from '../pages/storefront/ResetPasswordPage';
import VerifyEmailPage from '../pages/storefront/VerifyEmailPage';

// Placeholder Pages
const Home = () => <div>Home Page Placeholder</div>;
const Dashboard = () => <div>Admin Dashboard Placeholder</div>;

const AppRoutes = () => {
  return (
    <Routes>
      {/* Storefront Routes */}
      <Route path="/" element={<StoreLayout />}>
        <Route index element={<Home />} />
        
        {/* Auth */}
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />

        {/* Protected Storefront Routes */}
        <Route element={<ProtectedRoute />}>
           <Route path="profile" element={<div>Profile Placeholder</div>} />
        </Route>
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute role="admin" />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<div>Users Placeholder</div>} />
          <Route path="settings" element={<div>Settings Placeholder</div>} />
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRoutes;
