'use strict';

const { success, error } = require('../../utils/response');
const ShippingWebhookService = require('./shipping.webhook.service');
const AppError = require('../../utils/AppError');

exports.handleShiprocketWebhook = async (req, res, next) => {
    try {
        const result = await ShippingWebhookService.processWebhook('shiprocket', req.body, req.headers);
        return res.status(200).json({ success: true, ...result });
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

        // Internal failures must be retried by the provider. The event is only
        // acknowledged after authentication and durable processing succeed.
        return res.status(500).json({ success: false, code: 'WEBHOOK_PROCESSING_ERROR', message: 'Webhook processing failed' });
    }
};
