'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, Shipment, ShipmentEvent, ShippingProvider, Order, OrderItem, ShipmentItem, Product, Fulfillment } = require('../index');
const { resolveProvider } = require('./providers');
const NotificationService = require('../notification/notification.service');
const OrderService = require('../order/order.service');
const AppError = require('../../utils/AppError');

const STATUS_RANK = Object.freeze({
    unknown: -1,
    created: 0,
    packed: 1,
    shipped: 2,
    in_transit: 3,
    out_for_delivery: 4,
    delivery_failed: 5,
    delivered: 6,
    rto_initiated: 7,
    rto_in_transit: 8,
    rto: 9,
    cancelled: 10,
});

const TERMINAL_STATUSES = new Set(['delivered', 'rto', 'cancelled']);

const mapShipmentStatusToFulfillment = (status, currentStatus) => {
    if (['delivered', 'rto', 'cancelled'].includes(status)) {
        return status === 'rto' ? 'returned' : status;
    }
    if (['in_transit', 'out_for_delivery'].includes(status)) return 'shipped';
    if (['created', 'packed', 'shipped', 'delivery_failed', 'rto_initiated', 'rto_in_transit'].includes(status)) return status;
    return currentStatus;
};

const stableStringify = (value) => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const hashEventPayload = (payload) => crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');

const parsePayload = (payload) => {
    try {
        const parsed = Buffer.isBuffer(payload) ? JSON.parse(payload.toString('utf8')) : payload;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Payload must be a JSON object');
        return parsed;
    } catch (_) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid JSON payload in shipping webhook');
    }
};

const ALLOWED_RETRY_TRANSITIONS = new Set([
    'delivery_failed->out_for_delivery',
]);

const isRegression = (current, incoming) => {
    if (!incoming || incoming === 'unknown' || current === incoming) return false;
    if (TERMINAL_STATUSES.has(current)) return true;
    if (ALLOWED_RETRY_TRANSITIONS.has(`${current}->${incoming}`)) return false;
    const currentRank = STATUS_RANK[current] !== undefined ? STATUS_RANK[current] : 0;
    const incomingRank = STATUS_RANK[incoming] !== undefined ? STATUS_RANK[incoming] : -1;
    return incomingRank <= currentRank;
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
            transaction: t,
            // Prevent outer-join lock errors by locking the primary shipment row
            lock: t.LOCK?.UPDATE ? { level: t.LOCK.UPDATE, of: Shipment } : undefined,
        });

        if (!shipment) return { accepted: true, ignored: true, reason: 'unknown_shipment' };

        const fulfillment = shipment.fulfillment || (shipment.fulfillmentId ? await Fulfillment.findByPk(shipment.fulfillmentId, { transaction: t }) : null);
        const order = shipment.order || (shipment.orderId ? await Order.findByPk(shipment.orderId, { transaction: t }) : null);

        // Perform regression check before inserting events or updating state
        if (isRegression(shipment.status || 'created', normalizedEvent.status)) {
            return { accepted: true, ignored: true, reason: 'stale_status', shipmentId: shipment.id };
        }

        // Stable timestamp: use parsed timestamp from carrier, or a fixed epoch sentinel
        // so retries without timestamps produce the exact same fallback dedupe key.
        const stableTimestamp = normalizedEvent.timestamp && !Number.isNaN(new Date(normalizedEvent.timestamp).getTime())
            ? new Date(normalizedEvent.timestamp)
            : new Date(0);

        // Authentication uses the original bytes above. Event identity uses
        // normalized JSON so retries with reordered fields remain duplicates.
        const payloadHash = hashEventPayload(parsedPayload);
        const eventWhere = normalizedEvent.providerEventId
            ? { providerId: provider.id, providerEventId: normalizedEvent.providerEventId }
            : {
                providerId: provider.id,
                awb: normalizedEvent.awbCode || shipment.awb,
                eventStatus: normalizedEvent.status,
                eventTimestamp: stableTimestamp,
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
                eventTimestamp: stableTimestamp,
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

        // Record unknown statuses in statusHistory (Edge Case 10)
        if (normalizedEvent.status === 'unknown') {
            const rawStatus = parsedPayload?.current_status || parsedPayload?.status || 'unknown';
            await shipment.update({
                lastProviderError: `Unrecognized carrier status: ${rawStatus}`,
                statusHistory: [
                    ...(Array.isArray(shipment.statusHistory) ? shipment.statusHistory : []),
                    {
                        status: 'unknown',
                        rawStatus,
                        at: new Date(normalizedEvent.timestamp || Date.now()).toISOString(),
                        source: 'webhook',
                        location: normalizedEvent.location || null,
                    },
                ],
            }, { transaction: t });
            return { accepted: true, ignored: true, reason: 'unknown_status', shipmentId: shipment.id };
        }

        const statusChanged = shipment.status !== normalizedEvent.status;
        if (statusChanged) {
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

        if (fulfillment) {
            const nextFulfillmentStatus = mapShipmentStatusToFulfillment(normalizedEvent.status, fulfillment.status);
            if (nextFulfillmentStatus !== fulfillment.status) {
                await fulfillment.update({ status: nextFulfillmentStatus }, { transaction: t });
            }
        }

        let notification = null;
        if (order) {
            try {
                const orderShippingStatus = await OrderService.syncOrderShippingStatus(order, t);
                await OrderService.syncCodPaymentIfDelivered(order, t);
                if (['delivered', 'rto'].includes(orderShippingStatus)) {
                    await OrderService.syncOrderClosureIfComplete(order, t);
                }
            } catch (err) {
                console.warn('[Webhook] OrderService.syncOrderShippingStatus fallback triggered:', err.message);
                const [orderItems, orderShipments] = await Promise.all([
                    OrderItem.findAll({ where: { orderId: order.id }, include: [{ model: Product, as: 'product', attributes: ['id', 'requiresShipping'], required: false }], transaction: t }),
                    Shipment.findAll({ where: { orderId: order.id }, include: [{ model: ShipmentItem, as: 'items' }], transaction: t }),
                ]);
                const derivedShippingStatus = OrderService.deriveQuantityAwareOrderShippingStatus(orderItems, orderShipments);
                if (order.orderShippingStatus !== derivedShippingStatus || order.shipmentStatus !== derivedShippingStatus) {
                    await order.update({
                        orderShippingStatus: derivedShippingStatus,
                        shipmentStatus: derivedShippingStatus,
                    }, { transaction: t });
                }
            }
            if (statusChanged && ['out_for_delivery', 'delivered'].includes(normalizedEvent.status) && order.userId) {
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

/**
 * Reconcile tracking status for active shipments directly from carrier API.
 * Used when webhooks are delayed, dropped, or out of sync (Edge Case 10).
 */
const reconcileTracking = async ({ limit = 20 } = {}) => {
    const activeShipments = await Shipment.findAll({
        where: {
            providerState: 'completed',
            status: {
                [Op.in]: ['created', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivery_failed', 'rto_initiated', 'rto_in_transit'],
            },
            awb: { [Op.ne]: null },
        },
        include: [
            { model: ShippingProvider, as: 'provider' },
            { model: Fulfillment, as: 'fulfillment' },
            { model: Order, as: 'order' },
        ],
        order: [['updatedAt', 'ASC']],
        limit,
    });

    let reconciledCount = 0;
    for (const shipment of activeShipments) {
        if (!shipment.provider || !shipment.awb) continue;
        try {
            const adapter = resolveProvider(shipment.provider);
            if (typeof adapter.getTracking !== 'function') continue;

            const tracking = await adapter.getTracking({ awbCode: shipment.awb });
            let statusUpdated = false;
            let touchedInTx = false;
            let notification = null;
            if (tracking && tracking.status && tracking.status !== 'unknown') {
                await sequelize.transaction(async (t) => {
                    const freshShipment = await Shipment.findByPk(shipment.id, {
                        transaction: t,
                        lock: t.LOCK?.UPDATE ? { level: t.LOCK.UPDATE, of: Shipment } : undefined,
                    });
                    if (!freshShipment) return;

                    const currentStatus = freshShipment.status || 'created';

                    // Check for status regression against the fresh, locked database status
                    if (tracking.status === currentStatus || isRegression(currentStatus, tracking.status)) {
                        // Do not overwrite newer status from webhook! Touch updatedAt to keep round-robin rotation.
                        await freshShipment.update({
                            updatedAt: new Date(),
                            rawResponse: {
                                ...(freshShipment.rawResponse || {}),
                                lastPolledAt: new Date().toISOString(),
                                lastPolledStatus: tracking.status,
                            },
                        }, { transaction: t });
                        touchedInTx = true;
                        return;
                    }

                    await freshShipment.update({
                        status: tracking.status,
                        statusHistory: [
                            ...(Array.isArray(freshShipment.statusHistory) ? freshShipment.statusHistory : []),
                            {
                                status: tracking.status,
                                at: new Date().toISOString(),
                                source: 'reconciliation_poll',
                                location: tracking.location || null,
                            },
                        ],
                        rawResponse: {
                            ...(freshShipment.rawResponse || {}),
                            lastPolledAt: new Date().toISOString(),
                            lastPolledStatus: tracking.status,
                        },
                    }, { transaction: t });

                    const fulfillment = freshShipment.fulfillmentId
                        ? await Fulfillment.findByPk(freshShipment.fulfillmentId, { transaction: t })
                        : null;
                    if (fulfillment) {
                        const nextFulfillmentStatus = mapShipmentStatusToFulfillment(tracking.status, fulfillment.status);
                        if (nextFulfillmentStatus !== fulfillment.status) {
                            await fulfillment.update({ status: nextFulfillmentStatus }, { transaction: t });
                        }
                    }

                    if (freshShipment.orderId) {
                        try {
                            const targetOrder = await Order.findByPk(freshShipment.orderId, { transaction: t });
                            if (targetOrder) {
                                const orderShippingStatus = await OrderService.syncOrderShippingStatus(targetOrder, t);
                                await OrderService.syncCodPaymentIfDelivered(targetOrder, t);
                                if (['delivered', 'rto'].includes(orderShippingStatus)) {
                                    await OrderService.syncOrderClosureIfComplete(targetOrder, t);
                                }
                                if (targetOrder.userId && ['out_for_delivery', 'delivered'].includes(tracking.status)) {
                                    notification = { userId: targetOrder.userId, orderId: targetOrder.id, status: tracking.status };
                                }
                            }
                        } catch (err) {
                            console.warn('[Webhook] Tracking reconcile syncOrderShippingStatus fallback triggered:', err.message);
                            const [orderItems, orderShipments] = await Promise.all([
                                OrderItem.findAll({ where: { orderId: freshShipment.orderId }, include: [{ model: Product, as: 'product', attributes: ['id', 'requiresShipping'], required: false }], transaction: t }),
                                Shipment.findAll({ where: { orderId: freshShipment.orderId }, include: [{ model: ShipmentItem, as: 'items' }], transaction: t }),
                            ]);
                            const derivedShippingStatus = OrderService.deriveQuantityAwareOrderShippingStatus(orderItems, orderShipments);
                            await Order.update({
                                orderShippingStatus: derivedShippingStatus,
                                shipmentStatus: derivedShippingStatus,
                            }, { where: { id: freshShipment.orderId }, transaction: t });
                        }
                    }

                    touchedInTx = true;
                    reconciledCount++;
                    statusUpdated = true;
                });
            }

            if (statusUpdated && notification) {
                try {
                    await NotificationService.sendDeliveryUpdate(notification.userId, notification.orderId, notification.status);
                } catch (error) {
                    console.error('[reconcileTracking] Delivery notification failed:', error.message);
                }
            }

            // Avoid queue starvation (Edge Case 10): If status was not touched in transaction, touch updatedAt so
            // subsequent polling runs rotate fairly through all active shipments.
            if (!statusUpdated && !touchedInTx && typeof shipment.update === 'function') {
                await shipment.update({
                    updatedAt: new Date(),
                    rawResponse: {
                        ...(shipment.rawResponse || {}),
                        lastPolledAt: new Date().toISOString(),
                    },
                }).catch(() => null);
            }
        } catch (err) {
            console.error(`[reconcileTracking] Failed for shipment ${shipment.id} (AWB: ${shipment.awb}):`, err.message);
            // Touch record on error so a single failing carrier call does not block other shipments
            if (typeof shipment.update === 'function') {
                await shipment.update({
                    updatedAt: new Date(),
                    lastProviderError: `Tracking poll failed: ${err.message}`,
                }).catch(() => null);
            }
        }
    }
    return reconciledCount;
};

module.exports = { processWebhook, reconcileTracking, mapShipmentStatusToFulfillment, hashEventPayload };
