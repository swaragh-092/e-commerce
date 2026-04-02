import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute = ({ role }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null; // or a loading spinner

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If a specific role is required
  if (role) {
      if (role === 'admin' && user?.role !== 'admin' && user?.role !== 'super_admin') {
          return <Navigate to="/" replace />;
      }
      if (role === 'super_admin' && user?.role !== 'super_admin') {
          return <Navigate to="/" replace />;
      }
  }

  return <Outlet />;
};
