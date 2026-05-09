'use strict';
const localStorage = require('./LocalStorage');

/**
 * Storage Abstraction Factory
 * Returns the configured storage provider.
 */
const getStorageProvider = () => {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    
    switch (provider) {
        case 'local':
            return localStorage;
        // Future providers can be added here (e.g., 's3', 'gcs')
        default:
            return localStorage;
    }
};

module.exports = {
    getStorageProvider,
    localStorage, // Exported for direct access if needed (e.g., in app.js for static serving)
};
