import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute = ({ role, permission, permissions = [], requireAllPermissions = false }) => {
  const { isAuthenticated, loading, hasPermission, hasRole } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If a specific role is required
  if (role) {
    if (role === 'admin' && !hasRole('admin') && !hasRole('super_admin')) {
      return <Navigate to="/" replace />;
    }
    if (role === 'super_admin' && !hasRole('super_admin')) {
      return <Navigate to="/" replace />;
    }
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  if (permissions.length > 0) {
    const isAllowed = requireAllPermissions
      ? permissions.every((requiredPermission) => hasPermission(requiredPermission))
      : permissions.some((requiredPermission) => hasPermission(requiredPermission));

    if (!isAllowed) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};
