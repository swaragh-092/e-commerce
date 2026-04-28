'use strict';
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Encrypts a string using aes-256-gcm.
 * Returns an object with the ciphertext and metadata.
 */
const encrypt = (text) => {
    const keyStr = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
    if (!keyStr) {
        throw new Error('Encryption key not found in environment');
    }

    // Ensure key is 32 bytes
    const key = crypto.createHash('sha256').update(keyStr).digest();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    return {
        ciphertext: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        version: 1
    };
};

/**
 * Decrypts a previously encrypted object.
 */
const decrypt = (encryptedObj) => {
    const { ciphertext, iv, tag, version } = encryptedObj;
    
    if (version !== 1) {
        throw new Error(`Unsupported encryption version: ${version}`);
    }

    const keyStr = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
    if (!keyStr) {
        throw new Error('Encryption key not found in environment');
    }

    const key = crypto.createHash('sha256').update(keyStr).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

module.exports = { encrypt, decrypt };
