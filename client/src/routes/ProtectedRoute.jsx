import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute = ({ role }) => {
  const { isAuthenticated, user, loading } = useAuth();

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
    if (role === 'admin' && user?.role !== 'admin' && user?.role !== 'super_admin') {
      return <Navigate to="/" replace />;
    }
    if (role === 'super_admin' && user?.role !== 'super_admin') {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};
