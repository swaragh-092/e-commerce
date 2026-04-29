'use strict';

const router = require('express').Router();
const shippingWebhookController = require('./shipping.webhook.controller');

// Shiprocket sends POST webhooks on shipment status updates
router.post('/shiprocket', shippingWebhookController.handleShiprocketWebhook);

// Add other providers here later (e.g. ekart)

module.exports = router;
