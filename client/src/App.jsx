import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { CategoryProvider } from './context/CategoryContext';
import { NotificationProvider } from './context/NotificationContext';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsProvider>
          <NotificationProvider>
            <AuthProvider>
              <CartProvider>
                <CategoryProvider>
                  <WishlistProvider>
                    <AppRoutes />
                  </WishlistProvider>
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


// here i am working