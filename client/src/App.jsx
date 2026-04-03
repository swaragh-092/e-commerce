import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { CategoryProvider } from './context/CategoryContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SettingsProvider>
        <AuthProvider>
          <CartProvider>
            <CategoryProvider>
              <WishlistProvider>
                <AppRoutes />
              </WishlistProvider>
            </CategoryProvider>
          </CartProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}

export default App;
