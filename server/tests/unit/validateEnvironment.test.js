import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validateEnvironment } = require('../../src/utils/validateEnvironment');

describe('validateEnvironment', () => {
    const originalEnv = { ...process.env };
    let exitSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        process.env = { ...originalEnv };
        exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.restoreAllMocks();
    });

    it('does not throw temporal-dead-zone ReferenceError when CREDENTIAL_ENCRYPTION_KEY is absent outside production', () => {
        process.env.NODE_ENV = 'development';
        process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
        process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
        process.env.DB_HOST = 'localhost';
        delete process.env.CREDENTIAL_ENCRYPTION_KEY;

        expect(() => validateEnvironment()).not.toThrow();
        expect(exitSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('CREDENTIAL_ENCRYPTION_KEY is not set')
        );
    });

    it('blocks and exits process in production when CREDENTIAL_ENCRYPTION_KEY is absent', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
        process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
        process.env.DB_HOST = 'localhost';
        process.env.DB_PASSWORD = 'strong_password_123';
        delete process.env.CREDENTIAL_ENCRYPTION_KEY;

        validateEnvironment();
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('CREDENTIAL_ENCRYPTION_KEY is not set')
        );
    });
});
