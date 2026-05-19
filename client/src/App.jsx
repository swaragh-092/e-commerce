import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { CategoryProvider } from './context/CategoryContext';
import { BrandProvider } from './context/BrandContext';
import { NotificationProvider } from './context/NotificationContext';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import AppRoutes from './routes/AppRoutes';
import AuthRedirectListener from './components/common/AuthRedirectListener';

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsProvider>
          <NotificationProvider>
            <AuthProvider>
              <CartProvider>
                <CategoryProvider>
                  <BrandProvider>
                    <WishlistProvider>
                      <AuthRedirectListener />
                      <AppRoutes />
                    </WishlistProvider>
                  </BrandProvider>
                </CategoryProvider>
              </CartProvider>
            </AuthProvider>
          </NotificationProvider>
        </SettingsProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
