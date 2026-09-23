'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, Shipment, ShipmentEvent, ShippingProvider, Order, Fulfillment } = require('../index');
const { resolveProvider } = require('./providers');
const { deriveOrderShippingStatus } = require('../../utils/orderWorkflow');
const NotificationService = require('../notification/notification.service');
const AppError = require('../../utils/AppError');

const STATUS_RANK = Object.freeze({
    unknown: -1,
    created: 0,
    packed: 0,
    shipped: 1,
    in_transit: 1,
    out_for_delivery: 2,
    delivery_failed: 2,
    delivered: 3,
    rto_initiated: 3,
    rto_in_transit: 4,
    rto: 5,
    cancelled: 5,
});

const TERMINAL_STATUSES = new Set(['delivered', 'rto', 'cancelled']);

const asRawBuffer = (payload) => {
    if (Buffer.isBuffer(payload)) return payload;
    if (typeof payload === 'string') return Buffer.from(payload);
    return Buffer.from(JSON.stringify(payload));
};

const parsePayload = (payload) => {
    try {
        const parsed = Buffer.isBuffer(payload) ? JSON.parse(payload.toString('utf8')) : payload;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Payload must be a JSON object');
        return parsed;
    } catch (_) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid JSON payload in shipping webhook');
    }
};

const isRegression = (current, incoming) => {
    if (!incoming || incoming === 'unknown' || current === incoming) return false;
    if (TERMINAL_STATUSES.has(current)) return true;
    return STATUS_RANK[incoming] < STATUS_RANK[current];
};

const processWebhook = async (providerCode, payload, headers = {}) => {
    const result = await sequelize.transaction(async (t) => {
        const provider = await ShippingProvider.findOne({ where: { code: providerCode }, transaction: t });
        if (!provider || !provider.enabled) {
            throw new AppError('SHIPPING_PROVIDER_UNAVAILABLE', 503, `Shipping provider ${providerCode} is not enabled`);
        }

        const adapter = resolveProvider(provider);
        if (typeof adapter.verifyWebhookSignature !== 'function') {
            throw new AppError('WEBHOOK_AUTH_UNAVAILABLE', 503, `Webhook authentication is not configured for ${providerCode}`);
        }
        if (!(await adapter.verifyWebhookSignature(payload, headers))) {
            throw new AppError('FORBIDDEN', 403, 'Invalid shipping webhook authentication');
        }

        const parsedPayload = parsePayload(payload);
        const normalizedEvent = await adapter.handleWebhook(parsedPayload);
        if (!normalizedEvent.awbCode && !normalizedEvent.providerOrderId) {
            return { accepted: true, ignored: true, reason: 'missing_shipment_identifier' };
        }

        const shipment = await Shipment.findOne({
            where: {
                providerId: provider.id,
                [Op.or]: [
                    normalizedEvent.awbCode ? { awb: normalizedEvent.awbCode } : null,
                    normalizedEvent.providerOrderId ? { providerOrderId: normalizedEvent.providerOrderId } : null,
                    normalizedEvent.providerOrderId ? { providerShipmentId: normalizedEvent.providerOrderId } : null,
                    normalizedEvent.providerOrderId ? { providerRequestId: normalizedEvent.providerOrderId } : null,
                ].filter(Boolean),
            },
            include: [{ model: Fulfillment, as: 'fulfillment' }, { model: Order, as: 'order' }],
            transaction: t,
            lock: t.LOCK?.UPDATE,
        });

        if (!shipment) return { accepted: true, ignored: true, reason: 'unknown_shipment' };

        const payloadHash = crypto.createHash('sha256').update(asRawBuffer(payload)).digest('hex');
        const eventWhere = normalizedEvent.providerEventId
            ? { providerId: provider.id, providerEventId: normalizedEvent.providerEventId }
            : {
                providerId: provider.id,
                awb: normalizedEvent.awbCode || shipment.awb,
                eventStatus: normalizedEvent.status,
                eventTimestamp: normalizedEvent.timestamp,
                payloadHash,
            };
        if (await ShipmentEvent.findOne({ where: eventWhere, transaction: t })) {
            return { accepted: true, duplicate: true, shipmentId: shipment.id };
        }

        try {
            await ShipmentEvent.create({
                shipmentId: shipment.id,
                providerId: provider.id,
                providerEventId: normalizedEvent.providerEventId || null,
                awb: normalizedEvent.awbCode || shipment.awb,
                eventType: 'status_update',
                eventStatus: normalizedEvent.status,
                eventTimestamp: normalizedEvent.timestamp || new Date(),
                payloadHash,
                rawPayload: parsedPayload,
                processedAt: new Date(),
            }, { transaction: t });
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                return { accepted: true, duplicate: true, shipmentId: shipment.id };
            }
            throw error;
        }

        if (isRegression(shipment.status || 'created', normalizedEvent.status)) {
            return { accepted: true, ignored: true, reason: 'stale_status', shipmentId: shipment.id };
        }
        if (normalizedEvent.status === 'unknown') {
            return { accepted: true, ignored: true, reason: 'unknown_status', shipmentId: shipment.id };
        }

        if (shipment.status !== normalizedEvent.status) {
            await shipment.update({
                status: normalizedEvent.status,
                statusHistory: [
                    ...(Array.isArray(shipment.statusHistory) ? shipment.statusHistory : []),
                    {
                        status: normalizedEvent.status,
                        at: new Date(normalizedEvent.timestamp || Date.now()).toISOString(),
                        source: 'webhook',
                        location: normalizedEvent.location || null,
                    },
                ],
            }, { transaction: t });
        }

        if (shipment.fulfillment) {
            const nextFulfillmentStatus = ['delivered', 'rto'].includes(normalizedEvent.status)
                ? (normalizedEvent.status === 'rto' ? 'returned' : 'delivered')
                : normalizedEvent.status === 'in_transit' || normalizedEvent.status === 'out_for_delivery'
                    ? 'shipped'
                    : ['packed', 'shipped', 'delivery_failed', 'rto_initiated', 'rto_in_transit'].includes(normalizedEvent.status)
                        ? normalizedEvent.status
                    : shipment.fulfillment.status;
            if (nextFulfillmentStatus !== shipment.fulfillment.status) {
                await shipment.fulfillment.update({ status: nextFulfillmentStatus }, { transaction: t });
            }
        }

        let notification = null;
        const order = shipment.order || await Order.findByPk(shipment.orderId, { transaction: t });
        if (order) {
            const orderShipments = await Shipment.findAll({ where: { orderId: order.id }, transaction: t });
            const derivedShippingStatus = deriveOrderShippingStatus(orderShipments);
            if (order.orderShippingStatus !== derivedShippingStatus || order.shipmentStatus !== derivedShippingStatus) {
                await order.update({
                    orderShippingStatus: derivedShippingStatus,
                    shipmentStatus: derivedShippingStatus,
                }, { transaction: t });
            }
            if (['out_for_delivery', 'delivered'].includes(normalizedEvent.status) && order.userId) {
                notification = { userId: order.userId, orderId: order.id, status: normalizedEvent.status };
            }
        }

        return { accepted: true, shipmentId: shipment.id, notification };
    });

    // Notifications are external side effects. Send only after the transaction
    // commits so a retry cannot notify for a rolled-back status update.
    if (result.notification) {
        try {
            await NotificationService.sendDeliveryUpdate(
                result.notification.userId,
                result.notification.orderId,
                result.notification.status,
            );
        } catch (error) {
            console.error('[Webhook] Delivery notification failed:', error.message);
        }
    }
    return result;
};

module.exports = { processWebhook };
