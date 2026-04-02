import React, { createContext, useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import authService from '../services/authService';
import { userService } from '../services/userService';
import cartService, { clearSessionId } from '../services/cartService';

export const AuthContext = createContext(null);

const FullPageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
    <CircularProgress />
  </Box>
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const userData = await userService.getMe();
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Failed to restore session', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setIsAuthenticated(false);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    setUser(data.user);
    setIsAuthenticated(true);
    // Merge guest cart into authenticated cart
    try { await cartService.mergeGuestCart(); } catch (_) {}
    clearSessionId();
    return data;
  };

  const register = async (userData) => {
    // Option B: log in immediately after register and redirect to home
    const data = await authService.register(userData);
    setUser(data.user);
    setIsAuthenticated(true);
    try { await cartService.mergeGuestCart(); } catch (_) {}
    clearSessionId();
    return data;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  /** Re-fetches /users/me and updates context — use after profile/avatar changes */
  const refreshUser = async () => {
    const updatedUser = await userService.getMe();
    setUser(updatedUser);
    return updatedUser;
  };

  const updateProfile = async (data) => {
    const updatedUser = await userService.updateMe(data);
    setUser(updatedUser);
    return updatedUser;
  };

  const value = {
    user,
    isAuthenticated,
    loading,
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
