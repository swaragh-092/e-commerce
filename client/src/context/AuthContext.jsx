import React, { createContext, useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import authService from '../services/authService';
import { userService } from '../services/userService';
import cartService, { clearSessionId } from '../services/cartService';
import { getPermissionsForUser, getRolesForUser } from '../utils/permissions';

export const AuthContext = createContext(null);

const FullPageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
    <CircularProgress />
  </Box>
);

export const AuthProvider = ({ children }) => {
  // Hydrate from cache immediately so the UI has data before the first API round-trip
  const cachedUser = (() => {
    try { return JSON.parse(localStorage.getItem('userProfile') || 'null'); }
    catch { return null; }
  })();

  const [user, setUser] = useState(cachedUser);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(cachedUser));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const userData = await userService.getMe();
          setUser(userData);
          setIsAuthenticated(true);
          localStorage.setItem('userProfile', JSON.stringify(userData));
        } catch (error) {
          console.error('Failed to restore session', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userProfile');
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        localStorage.removeItem('userProfile');
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    };

    initAuth();

    const handleUnauthorized = () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userProfile');
      setUser(null);
      setIsAuthenticated(false);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    // Fetch full user data including profile (login response doesn't include profile)
    const fullUser = await userService.getMe();
    setUser(fullUser);
    setIsAuthenticated(true);
    localStorage.setItem('userProfile', JSON.stringify(fullUser));
    // Merge guest cart into authenticated cart
    try { await cartService.mergeGuestCart(); } catch (_) {}
    clearSessionId();
    return { ...data, user: fullUser };
  };

  const register = async (userData) => {
    // Option B: log in immediately after register and redirect to home
    const data = await authService.register(userData);
    const fullUser = await userService.getMe();
    setUser(fullUser);
    setIsAuthenticated(true);
    localStorage.setItem('userProfile', JSON.stringify(fullUser));
    try { await cartService.mergeGuestCart(); } catch (_) {}
    clearSessionId();
    return { ...data, user: fullUser };
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('userProfile');
  };

  /** Re-fetches /users/me and updates context — use after profile/avatar changes */
  const refreshUser = async () => {
    const updatedUser = await userService.getMe();
    setUser(updatedUser);
    localStorage.setItem('userProfile', JSON.stringify(updatedUser));
    return updatedUser;
  };

  const updateProfile = async (data) => {
    const updatedUser = await userService.updateMe(data);
    setUser(updatedUser);
    localStorage.setItem('userProfile', JSON.stringify(updatedUser));
    return updatedUser;
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    roles: getRolesForUser(user),
    permissions: getPermissionsForUser(user),
    hasRole: (role) => getRolesForUser(user).includes(role),
    hasPermission: (permission) => getPermissionsForUser(user).includes(permission),
    hasAnyPermission: (permissions = []) => permissions.some((permission) => getPermissionsForUser(user).includes(permission)),
    hasAllPermissions: (permissions = []) => permissions.every((permission) => getPermissionsForUser(user).includes(permission)),
    login,
    register,
    logout,
    updateProfile,
    refreshUser,
    setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <FullPageLoader /> : children}
    </AuthContext.Provider>
  );
};
