import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { Box, CircularProgress } from '@mui/material';
import authService from '../services/authService';
import { userService } from '../services/userService';
import cartService from '../services/cartService';
import { wishlistService } from '../services/wishlistService';
import { getPermissionsForUser, getRolesForUser } from '../utils/permissions';

export const AuthContext = createContext(null);

// Event fired when a refresh reveals the user lost at least one permission,
// so open dialogs can close and restricted state can clear immediately.
export const AUTH_PERMISSIONS_REVOKED_EVENT = 'auth:permissions-revoked';

// How often (ms) to re-validate the session against /users/me while logged in.
const AUTH_REFRESH_INTERVAL_MS = 60_000;

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
  // Start unauthenticated until /users/me confirms the session — cached profile
  // is display-only and must never grant permissions before verification.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastPermissionsRef = useRef(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // The browser sends the HttpOnly access cookie automatically. If it
        // has expired, api.js refreshes it using the HttpOnly refresh cookie.
        const userData = await userService.getMe();
        setUser(userData);
        setIsAuthenticated(true);
        lastPermissionsRef.current = new Set(getPermissionsForUser(userData));
        localStorage.setItem('userProfile', JSON.stringify(userData));
      } catch (error) {
        if (import.meta.env.DEV) console.debug('No authenticated session to restore', error);
        localStorage.removeItem('userProfile');
        setUser(null);
        setIsAuthenticated(false);
        lastPermissionsRef.current = null;
      }
      setLoading(false);
    };

    initAuth();

    const handleUnauthorized = () => {
      localStorage.removeItem('userProfile');
      setUser(null);
      setIsAuthenticated(false);
      lastPermissionsRef.current = null;
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Applies a refreshed /users/me payload. If the user lost any permission
  // since the last known state, fire a revocation event so open dialogs close
  // and restricted state clears immediately.
  const applyRefreshedUser = useCallback((updatedUser) => {
    const nextPerms = new Set(getPermissionsForUser(updatedUser));
    const prevPerms = lastPermissionsRef.current;
    const lost = prevPerms ? [...prevPerms].filter((p) => !nextPerms.has(p)) : [];
    setUser(updatedUser);
    localStorage.setItem('userProfile', JSON.stringify(updatedUser));
    lastPermissionsRef.current = nextPerms;
    if (lost.length > 0) {
      window.dispatchEvent(
        new CustomEvent(AUTH_PERMISSIONS_REVOKED_EVENT, { detail: { lostPermissions: lost } })
      );
    }
    return updatedUser;
  }, []);

  // Periodically re-validate the session and on tab focus/visibility so
  // revoked permissions are reflected without a full reload.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let cancelled = false;
    const refresh = async () => {
      try {
        const updated = await userService.getMe();
        if (!cancelled) applyRefreshedUser(updated);
      } catch {
        // Transient failures (e.g. network) are ignored; the auth:unauthorized
        // handler clears the session on a real 401.
      }
    };

    const intervalId = window.setInterval(refresh, AUTH_REFRESH_INTERVAL_MS);
    const onFocus = () => refresh();
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated, applyRefreshedUser]);

  const login = async (email, password, rememberMe = false) => {
    const data = await authService.login(email, password, rememberMe);
    // If 2FA is required, return early — caller handles the 2FA step
    if (data.requiresTwoFactor) {
      return data;
    }
    const fullUser = await finalizeAuthenticatedSession();
    return { ...data, user: fullUser };
  };

  const verifyTwoFactor = async (tempToken, code, trustDevice = false) => {
    const data = await authService.verifyTwoFactor(tempToken, code, trustDevice);
    const fullUser = await finalizeAuthenticatedSession();
    return { ...data, user: fullUser };
  };

  const register = async (userData) => {
    const data = await authService.register(userData);
    // When email verification is mandatory the server issues no session —
    // return early so the caller can route to the verification prompt.
    if (data.requiresVerification) {
      return data;
    }
    const fullUser = await finalizeAuthenticatedSession();
    return { ...data, user: fullUser };
  };

  const finalizeAuthenticatedSession = async () => {
    // Fetch full user data including profile (auth responses do not include the full profile shape).
    const fullUser = await userService.getMe();
    setUser(fullUser);
    setIsAuthenticated(true);
    localStorage.setItem('userProfile', JSON.stringify(fullUser));
    try { await cartService.mergeGuestCart(); } catch (_) {}
    try { await wishlistService.mergeGuestWishlist(); } catch (_) {}
    // Keep the guest session ID: guest orders are owned by this capability and
    // customers may sign in before cancelling or viewing their order.
    return fullUser;
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
    return applyRefreshedUser(updatedUser);
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
    verifyTwoFactor,
    finalizeAuthenticatedSession,
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
