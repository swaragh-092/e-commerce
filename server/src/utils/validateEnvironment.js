'use strict';

/**
 * Validates that all required environment variables are set and meet minimum
 * security requirements. Called before the server starts listening.
 *
 * Throws and exits the process if any critical variable is missing or weak.
 */
const validateEnvironment = () => {
    const errors = [];

    // ── JWT secrets ───────────────────────────────────────────────────────────
    const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

    if (!JWT_ACCESS_SECRET) {
        errors.push('JWT_ACCESS_SECRET is not set. Tokens would be unsigned and forgeable.');
    } else if (JWT_ACCESS_SECRET.length < 32) {
        errors.push(`JWT_ACCESS_SECRET is too short (${JWT_ACCESS_SECRET.length} chars). Minimum 32 characters required.`);
    }

    if (!JWT_REFRESH_SECRET) {
        errors.push('JWT_REFRESH_SECRET is not set. Refresh tokens would be unsigned and forgeable.');
    } else if (JWT_REFRESH_SECRET.length < 32) {
        errors.push(`JWT_REFRESH_SECRET is too short (${JWT_REFRESH_SECRET.length} chars). Minimum 32 characters required.`);
    }

    // Prevent using the same secret for access + refresh tokens
    if (JWT_ACCESS_SECRET && JWT_REFRESH_SECRET && JWT_ACCESS_SECRET === JWT_REFRESH_SECRET) {
        errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
    }

    // ── Database ──────────────────────────────────────────────────────────────
    if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
        errors.push('Neither DATABASE_URL nor DB_HOST is set. Cannot connect to database.');
    }

    // ── Payment (warn only — Razorpay is optional in dev) ────────────────────
    const warnings = [];
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        warnings.push('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — payment features will be disabled.');
    }
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
        warnings.push('RAZORPAY_WEBHOOK_SECRET not set — webhook signature verification will fail.');
    }

    // ── Report ────────────────────────────────────────────────────────────────
    if (warnings.length > 0) {
        warnings.forEach((w) => console.warn(`[ENV WARNING] ${w}`));
    }

    if (errors.length > 0) {
        console.error('\n🚫 FATAL: Server cannot start due to insecure or missing environment variables:\n');
        errors.forEach((e) => console.error(`  ✗ ${e}`));
        console.error('\nFix the above issues in your .env file and restart the server.\n');
        process.exit(1);
    }
};

module.exports = { validateEnvironment };
