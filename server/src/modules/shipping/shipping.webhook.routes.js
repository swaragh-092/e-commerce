'use strict';

const router = require('express').Router();
const shippingWebhookController = require('./shipping.webhook.controller');

const AppError = require('../../utils/AppError');

// Basic IP allowlist middleware for Shiprocket Webhooks
const ipAllowlist = (req, res, next) => {
    const allowedIps = (process.env.SHIPROCKET_WEBHOOK_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);
    // If no IPs configured, bypass check (rely on HMAC)
    if (allowedIps.length === 0) return next();
    
    // Get client IP with x-forwarded-for support
    let clientIp = req.headers['x-forwarded-for'] 
        ? req.headers['x-forwarded-for'].split(',')[0].trim() 
        : req.socket.remoteAddress;

    // Normalize IPv6-mapped IPv4
    if (clientIp && clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
    }
    
    if (allowedIps.includes(clientIp)) {
        return next();
    }
    
    console.warn(`Blocked webhook from unauthorized IP: ${clientIp}`);
    return next(new AppError('FORBIDDEN', 403, 'Unauthorized IP address'));
};

// Shiprocket sends POST webhooks on shipment status updates
router.post('/shiprocket', ipAllowlist, shippingWebhookController.handleShiprocketWebhook);

// Add other providers here later (e.g. ekart)

module.exports = router;
