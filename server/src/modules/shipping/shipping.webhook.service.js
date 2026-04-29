'use strict';

const { sequelize, Shipment, ShipmentEvent, ShippingProvider, Order, Fulfillment } = require('../index');
const { resolveProvider } = require('./providers');
const crypto = require('crypto');
const NotificationService = require('../notification/notification.service');

exports.processWebhook = async (providerCode, payload, headers) => {
    return sequelize.transaction(async (t) => {
        const provider = await ShippingProvider.findOne({ where: { code: providerCode }, transaction: t });
        if (!provider || !provider.enabled) {
            console.warn(`Webhook received for disabled or missing provider: ${providerCode}`);
            return;
        }

        const adapter = resolveProvider(provider);
        
        // Authenticate webhook payload
        const signature = headers['x-provider-signature'] || headers['x-shiprocket-signature'] || headers['x-api-key'];
        
        if (provider.webhookSecret && typeof adapter.verifySignature !== 'function') {
            console.error(`Security violation: Webhook secret configured but no verification implementation for provider: ${providerCode}`);
            throw new Error(`Provider ${providerCode} requires signature verification but implementation is missing`);
        }

        if (typeof adapter.verifySignature === 'function') {
            const isValid = await adapter.verifySignature(payload, signature, provider.webhookSecret);
            if (!isValid) {
                console.warn(`Invalid webhook signature for provider: ${providerCode}`);
                return;
            }
        }
        
        // Parse webhook payload using the adapter
        let parsedPayload;
        try {
            parsedPayload = Buffer.isBuffer(payload) ? JSON.parse(payload.toString('utf8')) : payload;
        } catch (err) {
            console.error(`Malformed JSON payload received for provider: ${providerCode}. Length: ${payload?.length}, Type: ${typeof payload}`);
            throw new Error('Invalid JSON payload in webhook');
        }
        const normalizedEvent = await adapter.handleWebhook(parsedPayload);
        
        if (!normalizedEvent.awbCode && !normalizedEvent.providerOrderId) {
            console.warn(`Webhook received without AWB or provider order ID for provider: ${providerCode}`);
            return;
        }

        // Find the shipment
        const shipment = await Shipment.findOne({
            where: normalizedEvent.awbCode ? { awb: normalizedEvent.awbCode } : { providerOrderId: normalizedEvent.providerOrderId },
            include: [{ model: Fulfillment, as: 'fulfillment' }, { model: Order, as: 'order' }],
            transaction: t,
        });

        if (!shipment) {
            console.warn(`Shipment not found for searchKey=${normalizedEvent.awbCode ? 'awb' : 'providerOrderId'} value=${normalizedEvent.awbCode || normalizedEvent.providerOrderId} (awb: ${normalizedEvent.awbCode}, providerOrderId: ${normalizedEvent.providerOrderId})`);
            return;
        }

        // Deduplicate events using a payload hash
        let hashSource = payload;
        if (Buffer.isBuffer(payload)) {
            hashSource = payload;
        } else if (typeof payload === 'string') {
            hashSource = Buffer.from(payload);
        } else {
            hashSource = Buffer.from(JSON.stringify(payload));
        }
        const payloadHash = crypto.createHash('sha256').update(hashSource).digest('hex');
        
        let isDuplicate = false;
        
        // 1. Primary Dedupe Strategy
        if (normalizedEvent.providerEventId) {
            const existingPrimary = await ShipmentEvent.findOne({
                where: {
                    providerId: provider.id,
                    providerEventId: normalizedEvent.providerEventId
                },
                transaction: t,
            });
            if (existingPrimary) isDuplicate = true;
        }

        // 2. Fallback Dedupe Strategy
        if (!isDuplicate && !normalizedEvent.providerEventId) {
            const fallbackWhere = {
                providerId: provider.id,
                awb: normalizedEvent.awbCode || shipment.awb,
                eventStatus: normalizedEvent.status,
                payloadHash,
            };

            // Only include timestamp in dedupe if it was provided in the webhook payload
            if (normalizedEvent.timestamp) {
                fallbackWhere.eventTimestamp = normalizedEvent.timestamp;
            }

            const existingFallback = await ShipmentEvent.findOne({
                where: fallbackWhere,
                transaction: t,
            });
            if (existingFallback) isDuplicate = true;
        }

        if (isDuplicate) {
            console.log('Duplicate webhook event skipped');
            return;
        }

        // Create shipment event record
        try {
            await ShipmentEvent.create({
                shipmentId: shipment.id,
                providerId: provider.id,
                providerEventId: normalizedEvent.providerEventId || null,
                awb: normalizedEvent.awbCode || shipment.awb,
                eventStatus: normalizedEvent.status,
                eventTimestamp: normalizedEvent.timestamp || new Date(),
                payloadHash,
                rawPayload: payload,
            }, { transaction: t });
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                console.log('Duplicate webhook event skipped (caught via unique constraint)');
                return;
            }
            throw err;
        }

        // Update shipment status if it has changed
        if (shipment.status !== normalizedEvent.status) {
            const newHistory = [...(shipment.statusHistory || []), {
                status: normalizedEvent.status,
                at: normalizedEvent.timestamp ? new Date(normalizedEvent.timestamp).toISOString() : new Date().toISOString(),
                source: 'webhook',
                location: normalizedEvent.location
            }];
            
            await shipment.update({
                status: normalizedEvent.status,
                statusHistory: newHistory,
            }, { transaction: t });

            // Propagate status back to Fulfillment
            if (shipment.fulfillment) {
                let fulfillmentStatus = shipment.fulfillment.status;
                if (['delivered', 'returned'].includes(normalizedEvent.status)) {
                    fulfillmentStatus = normalizedEvent.status;
                } else if (normalizedEvent.status === 'shipped' || normalizedEvent.status === 'out_for_delivery') {
                    fulfillmentStatus = 'shipped';
                }
                
                if (fulfillmentStatus !== shipment.fulfillment.status) {
                    await shipment.fulfillment.update({ status: fulfillmentStatus }, { transaction: t });
                }
            }

            // Notify customer if it's out for delivery or delivered
            if (['out_for_delivery', 'delivered'].includes(normalizedEvent.status) && shipment.order) {
                try {
                    await NotificationService.sendDeliveryUpdate(shipment.order.userId, shipment.order.id, normalizedEvent.status);
                } catch (err) {
                    console.error('Failed to send delivery update notification', err);
                }
            }
        }
    });
};
