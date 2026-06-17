import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { HelmetProvider } from 'react-helmet-async';

// Clean up any old/rogue service workers registered on localhost:3000
if ('serviceWorker' in navigator) {
  const SW_CLEANUP_KEY = 'sw_cleanup_done';
  const alreadyCleaned = sessionStorage.getItem(SW_CLEANUP_KEY);
  if (!alreadyCleaned) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length === 0) {
        sessionStorage.setItem(SW_CLEANUP_KEY, 'true');
        return;
      }
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('Successfully unregistered service worker:', registration);
            sessionStorage.setItem(SW_CLEANUP_KEY, 'true');
            window.location.reload();
          }
        });
      }
    });
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);

