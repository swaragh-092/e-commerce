'use strict';
const Stripe = require('stripe');
const { sequelize, Payment, Order, WebhookEvent } = require('../index');
const AppError = require('../../utils/AppError');

// Stripe is dynamically initialized from environment
if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError('INTERNAL_ERROR', 500, 'Stripe configuration missing');
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createIntent = async (userId, orderId) => {
    const order = await Order.findOne({ where: { id: orderId, userId } });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    
    if (order.status !== 'pending_payment') {
        throw new AppError('VALIDATION_ERROR', 400, 'Order is not in pending_payment status');
    }

    const amountInCents = Math.round(Number(order.total) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        metadata: {
            orderId: order.id,
            userId: userId
        }
    });

    await Payment.upsert({
        orderId: order.id,
        provider: 'stripe',
        transactionId: paymentIntent.id,
        amount: order.total,
        currency: 'usd',
        status: 'pending'
    });

    return { clientSecret: paymentIntent.client_secret };
};

const handleWebhook = async (payload, signature, secret) => {
    let event;
    try {
        event = stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
        throw new AppError('VALIDATION_ERROR', 400, `Webhook Error: ${err.message}`);
    }

    const existingEvent = await WebhookEvent.findByPk(event.id);
    if (existingEvent) {
        return { success: true, message: 'Event already processed' };
    }

    const intent = event.data.object;
    const orderId = intent.metadata?.orderId;
    
    if (orderId) {
        if (event.type === 'payment_intent.succeeded') {
            await sequelize.transaction(async (t) => {
                const order = await Order.findByPk(orderId, { transaction: t });
                if (order && order.status === 'pending_payment') {
                    await order.update({ status: 'paid' }, { transaction: t });
                }
                const payment = await Payment.findOne({ where: { transactionId: intent.id }, transaction: t });
                if (payment) {
                    await payment.update({ status: 'completed' }, { transaction: t });
                }
                await WebhookEvent.create({ id: event.id, eventType: event.type }, { transaction: t });
            });
        } else if (event.type === 'payment_intent.payment_failed') {
            await sequelize.transaction(async (t) => {
                const payment = await Payment.findOne({ where: { transactionId: intent.id }, transaction: t });
                if (payment) {
                    await payment.update({ status: 'failed' }, { transaction: t });
                }
                await WebhookEvent.create({ id: event.id, eventType: event.type }, { transaction: t });
            });
        }
    }

    return { received: true };
};

module.exports = { createIntent, handleWebhook };
