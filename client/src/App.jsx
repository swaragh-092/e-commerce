import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <BrowserRouter>
      {/* SettingsProvider handles theme initialization internally via MUI ThemeProvider */}
      <SettingsProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}

export default App;
