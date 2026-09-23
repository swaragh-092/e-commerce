'use strict';

const router = require('express').Router();
const shippingWebhookController = require('./shipping.webhook.controller');

const AppError = require('../../utils/AppError');

const ipv4ToNumber = (ip) => {
    const parts = String(ip || '').replace(/^::ffff:/, '').split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    return parts.reduce((value, part) => (value * 256) + part, 0) >>> 0;
};

const matchesIpRule = (ip, rule) => {
    const [network, bitsText] = String(rule).split('/');
    if (bitsText == null) return String(ip).replace(/^::ffff:/, '') === network;
    const address = ipv4ToNumber(ip);
    const base = ipv4ToNumber(network);
    const bits = Number(bitsText);
    if (address == null || base == null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (address & mask) === (base & mask);
};

// Shiprocket may provide fixed IPs or CIDR ranges. Authentication remains
// mandatory even when this optional network allowlist is not configured.
const ipAllowlist = (req, res, next) => {
    const allowedIps = (process.env.SHIPROCKET_WEBHOOK_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);
    // If no IPs configured, bypass check (rely on HMAC)
    if (allowedIps.length === 0) return next();
    
    const clientIp = req.ip || req.socket.remoteAddress;
    if (allowedIps.some((rule) => matchesIpRule(clientIp, rule))) {
        return next();
    }
    
    console.warn(`Blocked webhook from unauthorized IP: ${clientIp}`);
    return next(new AppError('FORBIDDEN', 403, 'Unauthorized IP address'));
};

// Shiprocket sends POST webhooks on shipment status updates
router.post('/shiprocket', ipAllowlist, shippingWebhookController.handleShiprocketWebhook);

// Add other providers here later (e.g. ekart)

module.exports = router;
