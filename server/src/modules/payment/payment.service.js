'use strict';
const crypto = require('crypto');
const { sequelize, Payment, Order, WebhookEvent, Setting, User } = require('../index');
const { encrypt, decrypt } = require('../../utils/crypto');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const logger = require('../../utils/logger');

let Razorpay;
let razorpayClient = null;
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || '2025-01-01';

// ─── DB-first credential reader ─────────────────────────────────────────────
// Reads from settings DB (group: 'gateway_credentials') first.
// Falls back to env vars so existing deployments keep working without changes.
const getCredential = async (dbKey, envKey) => {
    const row = await Setting.findOne({
        where: { group: 'gateway_credentials', key: dbKey },
    });
    
    let dbValue = null;
    if (row?.value) {
        if (typeof row.value === 'object' && row.value.ciphertext) {
            try {
                dbValue = decrypt(row.value);
            } catch (err) {
                console.error(`Failed to decrypt credential ${dbKey}:`, err);
                dbValue = null;
            }
        } else {
            dbValue = String(row.value).trim();
        }
    }

    return dbValue || process.env[envKey] || null;
};



const ensureCashfreeConfig = async () => {
    const appId  = await getCredential('cashfree.appId', 'CASHFREE_APP_ID');
    const secret = await getCredential('cashfree.secretKey', 'CASHFREE_SECRET_KEY');
    if (!appId || !secret) {
        throw new AppError('PAYMENT_UNAVAILABLE', 503, 'Cashfree configuration missing. Add your App ID and Secret Key in Payment Gateways settings.');
    }
    return { appId, secret };
};

const cashfreeRequest = async (path, { method = 'GET', body } = {}) => {
    const { appId, secret } = await ensureCashfreeConfig();
    const cfEnv = await getCredential('cashfree.mode', 'CASHFREE_ENV') || 'sandbox';
    const baseUrl = cfEnv === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-api-version': CASHFREE_API_VERSION,
            'x-client-id': appId,
            'x-client-secret': secret,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new AppError(
            'PAYMENT_ERROR',
            response.status,
            data?.message || data?.error_description || 'Cashfree request failed'
        );
    }
    return data;
};

const getRazorpayClient = async () => {
    const keyId     = await getCredential('razorpay.keyId', 'RAZORPAY_KEY_ID');
    const keySecret = await getCredential('razorpay.keySecret', 'RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
        throw new AppError('PAYMENT_UNAVAILABLE', 503, 'Razorpay configuration missing. Add your Key ID and Secret in Payment Gateways settings.');
    }

    try {
        Razorpay = Razorpay || require('razorpay');
    } catch (error) {
        throw new AppError('PAYMENT_UNAVAILABLE', 503, 'Razorpay SDK is not installed');
    }

    // Don't cache client since credentials may change via admin UI
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

/**
 * Creates a Razorpay Order
 */
const createRazorpayOrder = async (userId, order) => {
    const razorpay = await getRazorpayClient();

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
            provider: 'razorpay',
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
        };
    } catch (err) {
        throw new AppError('PAYMENT_ERROR', 400, `Razorpay Order Creation Failed: ${err.message}`);
    }
};

const createCashfreeOrder = async (userId, order) => {
    const currencySetting = await Setting.findOne({ where: { group: 'general', key: 'currency' } });
    const currency = (currencySetting?.value || 'INR').toUpperCase();
    const customer = await User.findByPk(userId, { attributes: ['id', 'firstName', 'lastName', 'email'] });
    const address = order.shippingAddressSnapshot || {};
    const customerName = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || address.fullName || 'Customer';
    const digitsOnly = (address.phone || '').replace(/\D/g, '');
    const customerPhone = digitsOnly.length === 10 ? digitsOnly : (digitsOnly.length > 10 ? digitsOnly.slice(-10) : '9999999999');
    const appUrl = process.env.CLIENT_URL?.split(',')?.[0] || process.env.APP_URL || 'http://localhost:3000';
    const apiUrl = process.env.API_PUBLIC_URL || process.env.SERVER_URL || 'http://localhost:5000/api';

    const cashfreeOrderId = `cf_${order.id}`;
    const cashfreeOrder = await cashfreeRequest('/orders', {
        method: 'POST',
        body: {
            order_id: cashfreeOrderId,
            order_amount: Number(Number(order.total).toFixed(2)),
            order_currency: currency,
            customer_details: {
                customer_id: String(userId),
                customer_name: customerName,
                customer_email: customer?.email || undefined,
                customer_phone: customerPhone,
            },
            order_meta: {
                return_url: `${appUrl}/payment/${order.id}?provider=cashfree&order_id=${cashfreeOrderId}`,
                notify_url: `${apiUrl}/payments/webhook/cashfree`,
            },
            order_note: `Order ${order.orderNumber || order.id}`,
        },
    });

    await Payment.upsert({
        orderId: order.id,
        provider: 'cashfree',
        transactionId: cashfreeOrder.order_id,
        amount: order.total,
        currency,
        status: 'pending',
        metadata: {
            cfOrderId: cashfreeOrder.cf_order_id,
            cashfreeOrderId: cashfreeOrder.order_id,
            orderStatus: cashfreeOrder.order_status,
        },
    });

    return {
        provider: 'cashfree',
        orderId: cashfreeOrder.order_id,
        paymentSessionId: cashfreeOrder.payment_session_id,
        amount: Math.round(Number(order.total) * 100),
        currency,
        mode: process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox',
    };
};

/**
 * Creates a provider payment order/session.
 */
const createOrder = async (userId, orderId) => {
    const order = await Order.findOne({ where: { id: orderId, userId } });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    if (order.status !== 'pending_payment') {
        throw new AppError('VALIDATION_ERROR', 400, 'Order is not in pending_payment status');
    }

    if (order.paymentMethod === 'razorpay') {
        return createRazorpayOrder(userId, order);
    }
    if (order.paymentMethod === 'cashfree') {
        return createCashfreeOrder(userId, order);
    }

    throw new AppError('PAYMENT_UNAVAILABLE', 503, `${order.paymentMethod} payment is not connected yet`);
};

/**
 * Verifies Razorpay Signature
 */
const verifyRazorpayPayment = async (userId, orderId, paymentData) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

    const keySecret = await getCredential('razorpay.keySecret', 'RAZORPAY_KEY_SECRET');
    if (!keySecret) {
        throw new AppError('PAYMENT_UNAVAILABLE', 503, 'Razorpay configuration missing');
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new AppError('VALIDATION_ERROR', 400, 'Missing payment verification data');
    }

    const order = await Order.findOne({ where: { id: orderId, userId } });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac("sha256", keySecret)
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

const markOrderPaid = async ({ orderId, provider, transactionId, metadata = {} }) => {
    await sequelize.transaction(async (t) => {
        const lockedOrder = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!lockedOrder) {
            throw new AppError('NOT_FOUND', 404, 'Order not found');
        }

        const previousOrderStatus = lockedOrder.status;
        if (lockedOrder.status === 'pending_payment') {
            await lockedOrder.update({ status: 'paid' }, { transaction: t });
        }

        const payment = await Payment.findOne({
            where: { orderId: lockedOrder.id, provider },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (payment && payment.status !== 'completed') {
            await payment.update({
                status: 'completed',
                transactionId: transactionId || payment.transactionId,
                metadata: {
                    ...(payment.metadata || {}),
                    ...metadata,
                },
            }, { transaction: t });
        }

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: lockedOrder.userId,
                    action: ACTIONS.STATUS_CHANGE,
                    entity: ENTITIES.PAYMENT,
                    entityId: payment?.id || transactionId || orderId,
                    changes: {
                orderStatus: { before: previousOrderStatus, after: lockedOrder.status },
                        provider,
                        transactionId,
                    },
                }, t);
            }
        } catch (err) {
            logger.error('Payment status audit log failed', {
                orderId,
                provider,
                errorMessage: err.message,
            });
        }
    });
};

const verifyCashfreePayment = async (userId, orderId) => {
    const order = await Order.findOne({ where: { id: orderId, userId } });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    if (order.paymentMethod !== 'cashfree') {
        throw new AppError('VALIDATION_ERROR', 400, 'This order is not a Cashfree order');
    }

    const payment = await Payment.findOne({ where: { orderId, provider: 'cashfree' } });
    const cashfreeOrderId = payment?.metadata?.cashfreeOrderId || payment?.transactionId || `cf_${order.id}`;
    const cashfreeOrder = await cashfreeRequest(`/orders/${encodeURIComponent(cashfreeOrderId)}`);

    if (cashfreeOrder.order_status === 'PAID') {
        await markOrderPaid({
            orderId: order.id,
            provider: 'cashfree',
            transactionId: cashfreeOrder.order_id,
            metadata: {
                cashfreeOrderId: cashfreeOrder.order_id,
                cfOrderId: cashfreeOrder.cf_order_id,
                orderStatus: cashfreeOrder.order_status,
                verifiedAt: new Date().toISOString(),
            },
        });
        return { success: true, status: 'paid' };
    }

    return { success: false, status: cashfreeOrder.order_status || 'pending' };
};

const parseRawJsonBody = (rawBody) => {
    if (Buffer.isBuffer(rawBody)) {
        return JSON.parse(rawBody.toString('utf8'));
    }
    if (typeof rawBody === 'string') {
        return JSON.parse(rawBody);
    }
    return rawBody;
};

const handleCashfreeWebhook = async (rawBody, headers = {}) => {
    const { secret } = await ensureCashfreeConfig();
    const signature = headers['x-webhook-signature'];
    const timestamp = headers['x-webhook-timestamp'];
    const rawPayload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');

    if (!signature || !timestamp || !rawPayload) {
        throw new AppError('VALIDATION_ERROR', 400, 'Missing Cashfree webhook signature data');
    }

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}${rawPayload}`)
        .digest('base64');

    if (expectedSignature !== signature) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid Cashfree webhook signature');
    }

    const payload = parseRawJsonBody(rawPayload);
    const eventType = payload?.type || payload?.event_type || 'cashfree.webhook';
    const orderEntity = payload?.data?.order || payload?.order || {};
    const paymentEntity = payload?.data?.payment || payload?.payment || {};
    const cashfreeOrderId = orderEntity.order_id || payload?.order_id || paymentEntity.order_id;
    const cashfreePaymentId = paymentEntity.cf_payment_id || paymentEntity.payment_id || payload?.cf_payment_id;
    const eventId = `cashfree:${eventType}:${cashfreePaymentId || cashfreeOrderId || timestamp}`;

    if (!cashfreeOrderId) {
        return { received: true, skipped: true };
    }

    try {
        await WebhookEvent.create({
            id: eventId,
            eventType,
            processedAt: new Date(),
        });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return { received: true, duplicate: true };
        }
        throw err;
    }

    const orderStatus = orderEntity.order_status || payload?.order_status;
    const paymentStatus = paymentEntity.payment_status || payload?.payment_status;

    if (orderStatus === 'PAID' || paymentStatus === 'SUCCESS') {
        const payment = await Payment.findOne({
            where: { provider: 'cashfree', transactionId: cashfreeOrderId },
        });

        if (payment) {
            await markOrderPaid({
                orderId: payment.orderId,
                provider: 'cashfree',
                transactionId: cashfreeOrderId,
                metadata: {
                    ...(payment.metadata || {}),
                    cfPaymentId: cashfreePaymentId,
                    orderStatus,
                    paymentStatus,
                    webhookEventType: eventType,
                    webhookAt: new Date().toISOString(),
                },
            });
        }
    }

    return { received: true };
};

const verifyPayment = async (userId, orderId, paymentData) => {
    const order = await Order.findOne({ where: { id: orderId, userId } });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

    if (order.paymentMethod === 'cashfree') {
        return verifyCashfreePayment(userId, orderId);
    }

    // Default to Razorpay
    return verifyRazorpayPayment(userId, orderId, paymentData);
};

const handleWebhook = async (payload, signature) => {
    // Razorpay Webhook — try DB first, then env
    const secret = await getCredential('razorpay.webhookSecret', 'RAZORPAY_WEBHOOK_SECRET');

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

/**
 * Confirms that cash was collected for a COD order (admin action).
 * Transitions order: pending_cod / processing → paid
 * Transitions payment: pending → cod_collected
 */
const confirmCodPayment = async (actingUserId, orderId) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
        if (order.paymentMethod !== 'cod') {
            throw new AppError('VALIDATION_ERROR', 400, 'This order is not a COD order');
        }
        if (!['pending_cod', 'processing'].includes(order.status)) {
            throw new AppError(
                'VALIDATION_ERROR',
                400,
                `Cannot confirm COD collection for a ${order.status} order`
            );
        }

        const previousStatus = order.status;
        await order.update({ status: 'paid' }, { transaction: t });

        const payment = await Payment.findOne({
            where: { orderId, provider: 'cod' },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (payment) {
            await payment.update({
                status: 'cod_collected',
                metadata: {
                    ...(payment.metadata || {}),
                    confirmedBy: actingUserId,
                    confirmedAt: new Date().toISOString(),
                },
            }, { transaction: t });
        }

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: ACTIONS.STATUS_CHANGE,
                    entity: ENTITIES.PAYMENT,
                    entityId: payment?.id || orderId,
                    changes: {
                        orderStatus: { before: previousStatus, after: 'paid' },
                        paymentStatus: { before: 'pending', after: 'cod_collected' },
                    },
                }, t);
            }
        } catch (err) {
            logger.error('COD confirmation audit log failed', { actingUserId, orderId, errorMessage: err.message });
        }

        return { success: true, orderId, status: 'paid' };
    });
};

// ─── Gateway Status ──────────────────────────────────────────────────────────
// Returns connection status for each gateway WITHOUT exposing the actual keys.
const getGatewayStatuses = async () => {
    const [rzpKeyId, rzpSecret, rzpWebhook, rzpMode,
           cfAppId, cfSecret, cfMode,
           stripeSecret, stripePublic, stripeWebhook,
           payuKey, payuSalt, payuMode] = await Promise.all([
        getCredential('razorpay.keyId', 'RAZORPAY_KEY_ID'),
        getCredential('razorpay.keySecret', 'RAZORPAY_KEY_SECRET'),
        getCredential('razorpay.webhookSecret', 'RAZORPAY_WEBHOOK_SECRET'),
        getCredential('razorpay.mode', null),
        getCredential('cashfree.appId', 'CASHFREE_APP_ID'),
        getCredential('cashfree.secretKey', 'CASHFREE_SECRET_KEY'),
        getCredential('cashfree.mode', 'CASHFREE_ENV'),
        getCredential('stripe.secretKey', 'STRIPE_SECRET_KEY'),
        getCredential('stripe.publishableKey', 'VITE_STRIPE_PUBLIC_KEY'),
        getCredential('stripe.webhookSecret', 'STRIPE_WEBHOOK_SECRET'),
        getCredential('payu.key', 'PAYU_MERCHANT_KEY'),
        getCredential('payu.salt', 'PAYU_MERCHANT_SALT'),
        getCredential('payu.mode', null),
    ]);

    // Helper: mask a key for display ('rzp_live_abc...xyz' → 'rzp_live_abc•••xyz')
    const mask = (val) => {
        if (!val || val.length < 8) return null;
        return val.slice(0, 8) + '•••' + val.slice(-4);
    };

    return [
        {
            id: 'razorpay',
            name: 'Razorpay',
            description: 'UPI, Credit/Debit Cards, Netbanking, Wallets & EMI',
            connected: Boolean(rzpKeyId && rzpSecret),
            mode: rzpMode || 'test',
            maskedKey: mask(rzpKeyId),
            hasWebhookSecret: Boolean(rzpWebhook),
            fields: [
                { key: 'razorpay.keyId',        label: 'Key ID',         placeholder: 'rzp_live_…', envFallback: 'RAZORPAY_KEY_ID' },
                { key: 'razorpay.keySecret',    label: 'Key Secret',     placeholder: '••••••••', secret: true, envFallback: 'RAZORPAY_KEY_SECRET' },
                { key: 'razorpay.webhookSecret',label: 'Webhook Secret', placeholder: '••••••••', secret: true, envFallback: 'RAZORPAY_WEBHOOK_SECRET' },
                { key: 'razorpay.mode',         label: 'Mode',           type: 'select', options: ['test', 'live'] },
            ],
        },
        {
            id: 'cashfree',
            name: 'Cashfree',
            description: 'UPI, Cards, Netbanking & Wallets — popular in India',
            connected: Boolean(cfAppId && cfSecret),
            mode: cfMode || 'sandbox',
            maskedKey: mask(cfAppId),
            hasWebhookSecret: true,
            fields: [
                { key: 'cashfree.appId',    label: 'App ID',      placeholder: 'Your Cashfree App ID', envFallback: 'CASHFREE_APP_ID' },
                { key: 'cashfree.secretKey',label: 'Secret Key',  placeholder: '••••••••', secret: true, envFallback: 'CASHFREE_SECRET_KEY' },
                { key: 'cashfree.mode',     label: 'Mode',        type: 'select', options: ['sandbox', 'production'] },
            ],
        },
        {
            id: 'stripe',
            name: 'Stripe',
            description: 'Cards, Apple Pay, Google Pay & 135+ currencies worldwide',
            connected: Boolean(stripeSecret && stripePublic),
            mode: stripeSecret?.startsWith('sk_live') ? 'live' : 'test',
            maskedKey: mask(stripePublic),
            hasWebhookSecret: Boolean(stripeWebhook),
            fields: [
                { key: 'stripe.publishableKey', label: 'Publishable Key', placeholder: 'pk_live_…', envFallback: 'VITE_STRIPE_PUBLIC_KEY' },
                { key: 'stripe.secretKey',      label: 'Secret Key',      placeholder: 'sk_live_…', secret: true, envFallback: 'STRIPE_SECRET_KEY' },
                { key: 'stripe.webhookSecret',  label: 'Webhook Secret',  placeholder: 'whsec_…', secret: true, envFallback: 'STRIPE_WEBHOOK_SECRET' },
            ],
            comingSoon: true, // backend integration pending
        },
        {
            id: 'payu',
            name: 'PayU',
            description: 'Cards, UPI, Netbanking & Wallets — widely used in India',
            connected: Boolean(payuKey && payuSalt),
            mode: payuMode || 'test',
            maskedKey: mask(payuKey),
            hasWebhookSecret: false,
            fields: [
                { key: 'payu.key',  label: 'Merchant Key',  placeholder: 'Your PayU Key', envFallback: 'PAYU_MERCHANT_KEY' },
                { key: 'payu.salt', label: 'Merchant Salt', placeholder: '••••••••', secret: true, envFallback: 'PAYU_MERCHANT_SALT' },
                { key: 'payu.mode', label: 'Mode',          type: 'select', options: ['test', 'production'] },
            ],
            comingSoon: true, // backend integration pending
        },
        {
            id: 'cod',
            name: 'Cash on Delivery',
            description: 'Accept payment at the door — no API keys required',
            connected: true, // always available
            mode: null,
            maskedKey: null,
            hasWebhookSecret: false,
            fields: [], // no credentials needed
        },
    ];
};

// ─── Save Gateway Credentials ────────────────────────────────────────────────
// Saves credentials for a single gateway to the settings DB.
// Never touches env vars — purely DB-driven.
const saveGatewayCredentials = async (gatewayId, credentials, actingUserId) => {
    const ALLOWED_GATEWAYS = ['razorpay', 'cashfree', 'stripe', 'payu'];
    if (!ALLOWED_GATEWAYS.includes(gatewayId)) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid gateway ID');
    }

    // credentials is { 'razorpay.keyId': 'rzp_…', 'razorpay.keySecret': '…', … }
    // Validate all keys belong to this gateway
    const entries = Object.entries(credentials).filter(([k]) => k.startsWith(`${gatewayId}.`));
    if (entries.length === 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'No credentials provided');
    }

    await sequelize.transaction(async (t) => {
        for (const [key, value] of entries) {
            if (value === null || value === undefined || String(value).trim() === '') {
                // Delete the setting to revert to env var fallback
                await Setting.destroy({ where: { group: 'gateway_credentials', key }, transaction: t });
            } else {
                const encryptedValue = encrypt(String(value).trim());
                await Setting.upsert(
                    { group: 'gateway_credentials', key, value: encryptedValue, updatedBy: actingUserId },
                    { conflictFields: ['group', 'key'], transaction: t }
                );
            }
        }

        try {
            if (AuditService?.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: ACTIONS.UPDATE,
                    entity: ENTITIES.SETTING,
                    entityId: `gateway:${gatewayId}`,
                    changes: { gateway: gatewayId, keysUpdated: entries.map(([k]) => k) },
                }, t);
            }
        } catch (err) {
            logger.error('Gateway credential audit log failed', { gatewayId, errorMessage: err.message });
        }
    });

    return { success: true, gateway: gatewayId };
};

module.exports = { createOrder, verifyPayment, handleWebhook, handleCashfreeWebhook, confirmCodPayment, getGatewayStatuses, saveGatewayCredentials };
