'use strict';

const { success, error } = require('../../utils/response');
const ShippingWebhookService = require('./shipping.webhook.service');
const AppError = require('../../utils/AppError');

exports.handleShiprocketWebhook = async (req, res, next) => {
    try {
        // Ensure Shiprocket authentication if they send a specific header (e.g. x-api-key)
        // Usually providers send a signature or token.
        // We pass the raw body to the service so the adapter can verify the HMAC signature.
        await ShippingWebhookService.processWebhook('shiprocket', req.body, req.headers);
        
        // Always return 200 OK to acknowledge receipt
        res.status(200).send('OK');
    } catch (err) {
        // Log the full error for debugging
        console.error('[Webhook: Shiprocket] Error processing webhook:', err);

        // If it's an operational error (auth/validation), return the specific status code
        if (err instanceof AppError || err.isOperational) {
            return res.status(err.statusCode || 400).json({
                success: false,
                code: err.code || 'WEBHOOK_ERROR',
                message: err.message
            });
        }

        // For non-operational (internal) errors, return 200 to acknowledge receipt and avoid retries
        res.status(200).send('Acknowledged with internal errors');
    }
};
