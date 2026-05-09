import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Returns true when the logged-in user is a Super Admin.
 * Super Admins have exclusive access to platform-level settings (Tier 2 feature toggles).
 */
export const useIsSuperAdmin = () => {
  const { hasRole } = useAuth();
  return hasRole('super_admin');
};
