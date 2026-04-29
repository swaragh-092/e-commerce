'use strict';

const cryptoUtils = require('../../utils/crypto');

/**
 * Decrypts shipping provider credentials.
 * Handles the stored JSON format (encrypted object stringified).
 * 
 * @param {string|object} encryptedRecord - The credentialsEncrypted field from DB
 * @returns {object} The decrypted credentials object
 */
const decryptCredentials = (encryptedRecord) => {
    if (!encryptedRecord) return {};
    
    try {
        const encryptedData = typeof encryptedRecord === 'string'
            ? JSON.parse(encryptedRecord)
            : encryptedRecord;
            
        if (encryptedData && encryptedData.ciphertext && encryptedData.iv) {
            const decryptedString = cryptoUtils.decrypt(encryptedData);
            try {
                return JSON.parse(decryptedString);
            } catch (e) {
                return decryptedString;
            }
        }
        
        return encryptedData || {};
    } catch (err) {
        return typeof encryptedRecord === 'object' ? encryptedRecord : {};
    }
};

module.exports = {
    decryptCredentials
};
