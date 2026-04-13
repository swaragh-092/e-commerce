'use strict';
const crypto = require('crypto');
const { sequelize, Payment, Order, WebhookEvent, Setting } = require('../index');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const logger = require('../../utils/logger');

let Razorpay;
let razorpayClient = null;

const getRazorpayClient = () => {
    if (razorpayClient) {
        return razorpayClient;
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new AppError('PAYMENT_UNAVAILABLE', 503, 'Razorpay configuration missing');
    }

    try {
        Razorpay = Razorpay || require('razorpay');
    } catch (error) {
        throw new AppError('PAYMENT_UNAVAILABLE', 503, 'Razorpay SDK is not installed');
    }

    razorpayClient = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    return razorpayClient;
};

/**
 * Creates a Razorpay Order
 */
const createOrder = async (userId, orderId) => {
    const razorpay = getRazorpayClient();
    const order = await Order.findOne({ where: { id: orderId, userId } });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    
    if (order.status !== 'pending_payment') {
        throw new AppError('VALIDATION_ERROR', 400, 'Order is not in pending_payment status');
    }

    // Read currency from settings, fallback to 'INR'
    const currencySetting = await Setting.findOne({ where: { group: 'general', key: 'currency' } });
    const currency = (currencySetting?.value || 'INR').toUpperCase();

    // Razorpay expects amount in subunits (paise for INR, cents for USD)
    const amountInSubunits = Math.round(Number(order.total) * 100);

    try {
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInSubunits,
            currency,
            receipt: `order_rcptid_${order.id}`,
            notes: {
                orderId: order.id,
                userId: userId,
            },
        });

        await Payment.upsert({
            orderId: order.id,
            provider: 'razorpay',
            transactionId: razorpayOrder.id,
            amount: order.total,
            currency,
            status: 'pending',
        });

        return {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
        };
    } catch (err) {
        throw new AppError('PAYMENT_ERROR', 400, `Razorpay Order Creation Failed: ${err.message}`);
    }
};

/**
 * Verifies Razorpay Signature
 */
const verifyPayment = async (userId, orderId, paymentData) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

    if (!process.env.RAZORPAY_KEY_SECRET) {
        throw new AppError('PAYMENT_UNAVAILABLE', 503, 'Razorpay configuration missing');
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new AppError('VALIDATION_ERROR', 400, 'Missing payment verification data');
    }

    const order = await Order.findOne({ where: { id: orderId, userId } });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        throw new AppError('PAYMENT_ERROR', 400, 'Invalid payment signature');
    }

    // Success: Update Order and Payment status
    await sequelize.transaction(async (t) => {
        const lockedOrder = await Order.findByPk(order.id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!lockedOrder || lockedOrder.userId !== userId) {
            throw new AppError('NOT_FOUND', 404, 'Order not found');
        }

        const previousOrderStatus = lockedOrder.status;
        await lockedOrder.update({ status: 'paid' }, { transaction: t });
        
        const payment = await Payment.findOne({ 
            where: { orderId: lockedOrder.id, transactionId: razorpay_order_id },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });
        
        if (payment) {
            await payment.update({ 
                status: 'completed',
                transactionId: razorpay_payment_id, // Link to actual payment ID
                metadata: { razorpay_order_id }
            }, { transaction: t });
        }

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId,
                    action: ACTIONS.STATUS_CHANGE,
                    entity: ENTITIES.PAYMENT,
                    entityId: payment?.id || razorpay_payment_id,
                    changes: {
                        orderStatus: { before: previousOrderStatus, after: 'paid' },
                        paymentId: razorpay_payment_id,
                    },
                }, t);
            }
        } catch (err) {
            logger.error('Payment verification audit log failed', {
                userId,
                action: ACTIONS.STATUS_CHANGE,
                entity: ENTITIES.PAYMENT,
                entityId: payment?.id || razorpay_payment_id,
                operation: 'AuditService.log.paymentVerification',
                errorMessage: err.message,
                stack: err.stack,
            });
        }
    });

    return { success: true };
};

const handleWebhook = async (payload, signature) => {
    // Razorpay Webhook Verification
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
        throw new AppError('PAYMENT_UNAVAILABLE', 503, 'Razorpay webhook configuration missing');
    }

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

    if (expectedSignature !== signature) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid webhook signature');
    }

    const event = payload.event;
    // Razorpay uses its payment entity ID as the unique event identifier
    const paymentEntity = payload.payload?.payment?.entity;
    const razorpayEventId = paymentEntity?.id;

    if (!razorpayEventId) {
        // Malformed payload — acknowledge without processing
        return { received: true, skipped: true };
    }

    // ── Idempotency check — uses WebhookEvent PK as a deduplication fence ──
    // This insert + order update are wrapped in a single transaction so concurrent
    // duplicate webhook deliveries cannot both slip through the status check.
    try {
        await sequelize.transaction(async (t) => {
            // INSERT will throw a unique-constraint error if this event was already processed.
            // We catch that specific error below and return early.
            await WebhookEvent.create(
                { id: razorpayEventId, eventType: event, processedAt: new Date() },
                { transaction: t }
            );

            // Only process recognized events
            if (event === 'payment.captured') {
                const orderId = paymentEntity.notes?.orderId;
                if (!orderId) return;

                const order = await Order.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
                if (order && order.status === 'pending_payment') {
                    await order.update({ status: 'paid' }, { transaction: t });
                }

                const payment = await Payment.findOne({
                    where: { orderId },
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });
                if (payment && payment.status !== 'completed') {
                    await payment.update({
                        status: 'completed',
                        transactionId: paymentEntity.id,
                    }, { transaction: t });
                }
            }
        });
    } catch (err) {
        // Sequelize unique constraint violation = duplicate event — safe to ignore
        if (err.name === 'SequelizeUniqueConstraintError') {
            return { received: true, duplicate: true };
        }
        throw err;
    }

    return { received: true };
};

module.exports = { createOrder, verifyPayment, handleWebhook };
