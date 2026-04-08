'use strict';
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sequelize, Payment, Order, WebhookEvent, Setting } = require('../index');
const AppError = require('../../utils/AppError');

// Razorpay is initialized from environment
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new AppError('INTERNAL_ERROR', 500, 'Razorpay configuration missing');
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Creates a Razorpay Order
 */
const createOrder = async (userId, orderId) => {
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
        await order.update({ status: 'paid' }, { transaction: t });
        
        const payment = await Payment.findOne({ 
            where: { orderId: order.id, transactionId: razorpay_order_id },
            transaction: t 
        });
        
        if (payment) {
            await payment.update({ 
                status: 'completed',
                transactionId: razorpay_payment_id, // Link to actual payment ID
                metadata: { razorpay_order_id }
            }, { transaction: t });
        }
    });

    return { success: true };
};

const handleWebhook = async (payload, signature) => {
    // Razorpay Webhook Verification
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(payload))
        .digest("hex");

    if (expectedSignature !== signature) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid webhook signature');
    }

    const event = payload.event;
    const paymentEntity = payload.payload.payment.entity;
    const orderId = paymentEntity.notes?.orderId;

    if (orderId && event === 'payment.captured') {
        await sequelize.transaction(async (t) => {
            const order = await Order.findByPk(orderId, { transaction: t });
            if (order && order.status === 'pending_payment') {
                await order.update({ status: 'paid' }, { transaction: t });
            }
            
            const payment = await Payment.findOne({ 
                where: { orderId: orderId }, 
                transaction: t 
            });
            
            if (payment && payment.status !== 'completed') {
                await payment.update({ 
                    status: 'completed',
                    transactionId: paymentEntity.id 
                }, { transaction: t });
            }
        });
    }

    return { received: true };
};

module.exports = { createOrder, verifyPayment, handleWebhook };
