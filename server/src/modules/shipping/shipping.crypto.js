'use strict';

const cryptoUtils = require('../../utils/crypto');
const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');

/**
 * Decrypts shipping provider credentials.
 * Handles the stored JSON format (encrypted object stringified).
 * 
 * @param {string|object} encryptedRecord - The credentialsEncrypted field from DB
 * @returns {object} The decrypted credentials object
 */
const decryptCredentials = (encryptedRecord) => {
    if (!encryptedRecord) return {};

    let encryptedData;
    if (typeof encryptedRecord === 'string') {
        try {
            encryptedData = JSON.parse(encryptedRecord);
        } catch (_) {
            return {};
        }
    } else {
        encryptedData = encryptedRecord;
    }

    if (encryptedData && typeof encryptedData === 'object' && encryptedData.ciphertext && encryptedData.iv) {
        try {
            const decryptedString = cryptoUtils.decrypt(encryptedData);
            try {
                return JSON.parse(decryptedString);
            } catch (e) {
                return decryptedString;
            }
        } catch (err) {
            logger.error('[shipping.crypto] Failed to decrypt provider credentials:', err);
            throw new AppError('CREDENTIAL_DECRYPTION_FAILED', 500, 'Failed to decrypt shipping provider credentials');
        }
    }

    return typeof encryptedData === 'object' && encryptedData !== null ? encryptedData : {};
};

const decryptSecret = (encryptedRecord) => {
    if (!encryptedRecord) return '';
    let encryptedData = null;
    if (typeof encryptedRecord === 'string') {
        try {
            encryptedData = JSON.parse(encryptedRecord);
        } catch (_) {
            return encryptedRecord; // Plaintext string
        }
    } else if (typeof encryptedRecord === 'object' && encryptedRecord !== null) {
        encryptedData = encryptedRecord;
    }

    if (encryptedData && typeof encryptedData === 'object' && encryptedData.ciphertext && encryptedData.iv) {
        try {
            return cryptoUtils.decrypt(encryptedData);
        } catch (err) {
            logger.error('[shipping.crypto] Failed to decrypt webhook secret:', err);
            throw new AppError('SECRET_DECRYPTION_FAILED', 500, 'Failed to decrypt shipping webhook secret');
        }
    }
    return String(encryptedRecord);
};

module.exports = {
    decryptCredentials,
    decryptSecret,
};
