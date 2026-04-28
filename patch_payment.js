const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server/src/modules/payment/payment.service.js');
let code = fs.readFileSync(file, 'utf8');

const stripePayUCode = `
const ensureStripeConfig = async () => {
    const secret = await getCredential('stripe.secretKey', 'STRIPE_SECRET_KEY');
    if (!secret) {
        throw new AppError('PAYMENT_UNAVAILABLE', 503, 'Stripe configuration missing.');
    }
    return { secret };
};

const createStripeOrder = async (userId, order) => {
    const { secret } = await ensureStripeConfig();
    const stripe = require('stripe')(secret);
    const currencySetting = await Setting.findOne({ where: { group: 'general', key: 'currency' } });
    const currency = (currencySetting?.value || 'INR').toLowerCase();
    const amountInSubunits = Math.round(Number(order.total) * 100);
    const appUrl = process.env.CLIENT_URL?.split(',')?.[0] || process.env.APP_URL || 'http://localhost:3000';

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: currency,
                    product_data: { name: \`Order #\${order.orderNumber || order.id}\` },
                    unit_amount: amountInSubunits,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: \`\${appUrl}/payment/\${order.id}?provider=stripe&session_id={CHECKOUT_SESSION_ID}\`,
            cancel_url: \`\${appUrl}/payment/failure?orderId=\${order.id}\`,
            client_reference_id: order.id,
            metadata: { orderId: order.id, userId: userId }
        });

        await Payment.upsert({
            orderId: order.id,
            provider: 'stripe',
            transactionId: session.id,
            amount: order.total,
            currency: currency.toUpperCase(),
            status: 'pending',
            metadata: { sessionId: session.id },
        });

        return { provider: 'stripe', url: session.url, sessionId: session.id };
    } catch (err) {
        throw new AppError('PAYMENT_ERROR', 400, \`Stripe Error: \${err.message}\`);
    }
};

const verifyStripePayment = async (userId, orderId, sessionId) => {
    const { secret } = await ensureStripeConfig();
    const stripe = require('stripe')(secret);

    const order = await Order.findOne({ where: { id: orderId, userId } });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
        await markOrderPaid({
            orderId: order.id,
            provider: 'stripe',
            transactionId: session.payment_intent || session.id,
            metadata: { sessionId: session.id, paymentStatus: session.payment_status },
        });
        return { success: true, status: 'paid' };
    }
    return { success: false, status: session.payment_status };
};

const handleStripeWebhook = async (rawBody, signature) => {
    const secret = await getCredential('stripe.webhookSecret', 'STRIPE_WEBHOOK_SECRET');
    if (!secret) return { received: true, skipped: true };
    const stripe = require('stripe')(await getCredential('stripe.secretKey', 'STRIPE_SECRET_KEY'));
    
    let event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
        throw new AppError('VALIDATION_ERROR', 400, \`Webhook Error: \${err.message}\`);
    }

    const eventId = \`stripe:\${event.id}\`;
    try {
        await WebhookEvent.create({ id: eventId, eventType: event.type, processedAt: new Date() });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') return { received: true, duplicate: true };
        throw err;
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata.orderId || session.client_reference_id;
        if (session.payment_status === 'paid' && orderId) {
            await markOrderPaid({
                orderId: orderId,
                provider: 'stripe',
                transactionId: session.payment_intent || session.id,
                metadata: { sessionId: session.id, paymentStatus: session.payment_status },
            });
        }
    }
    return { received: true };
};

const ensurePayUConfig = async () => {
    const key = await getCredential('payu.key', 'PAYU_MERCHANT_KEY');
    const salt = await getCredential('payu.salt', 'PAYU_MERCHANT_SALT');
    if (!key || !salt) {
        throw new AppError('PAYMENT_UNAVAILABLE', 503, 'PayU configuration missing.');
    }
    return { key, salt };
};

const createPayUOrder = async (userId, order) => {
    const { key, salt } = await ensurePayUConfig();
    const customer = await User.findByPk(userId, { attributes: ['id', 'firstName', 'lastName', 'email'] });
    const address = order.shippingAddressSnapshot || {};
    const customerName = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || address.fullName || 'Customer';
    const digitsOnly = (address.phone || '').replace(/\\D/g, '');
    const phone = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : '9999999999';
    const email = customer?.email || 'customer@example.com';
    const txnid = \`pu_\${order.id}_\${Date.now()}\`;
    const amount = Number(order.total).toFixed(2);
    const productinfo = \`Order \${order.id}\`;
    const firstname = customerName.split(' ')[0] || 'Customer';
    const apiUrl = process.env.API_PUBLIC_URL || process.env.SERVER_URL || 'http://localhost:5000/api';
    const surl = \`\${apiUrl}/payments/payu/return\`;
    const furl = \`\${apiUrl}/payments/payu/return\`;
    const hashString = \`\${key}|\${txnid}|\${amount}|\${productinfo}|\${firstname}|\${email}|||||||||||\${salt}\`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');
    const mode = await getCredential('payu.mode', null);

    await Payment.upsert({
        orderId: order.id,
        provider: 'payu',
        transactionId: txnid,
        amount: order.total,
        currency: 'INR',
        status: 'pending',
        metadata: { payuTxnId: txnid },
    });

    return {
        provider: 'payu',
        action: mode === 'production' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment',
        fields: { key, txnid, amount, productinfo, firstname, email, phone, surl, furl, hash }
    };
};

const handlePayUReturn = async (payload) => {
    const { key, salt } = await ensurePayUConfig();
    const { txnid, amount, productinfo, firstname, email, status, hash, mihpayid } = payload;
    
    // reverse hash: salt|status|||||||||||email|firstname|productinfo|amount|txnid|key
    const hashString = \`\${salt}|\${status}|||||||||||\${email}|\${firstname}|\${productinfo}|\${amount}|\${txnid}|\${key}\`;
    const expectedHash = crypto.createHash('sha512').update(hashString).digest('hex');

    const payment = await Payment.findOne({ where: { provider: 'payu', transactionId: txnid } });
    if (!payment) return { success: false, error: 'Payment not found' };

    if (expectedHash === hash && status === 'success') {
        await markOrderPaid({
            orderId: payment.orderId,
            provider: 'payu',
            transactionId: mihpayid || txnid,
            metadata: { payuTxnId: txnid, payuId: mihpayid, status },
        });
        return { success: true, orderId: payment.orderId };
    }
    return { success: false, orderId: payment.orderId, status };
};
`;

if (!code.includes('createStripeOrder')) {
    code = code.replace(
        'const createOrder = async (userId, orderId) => {',
        `${stripePayUCode}\n\nconst createOrder = async (userId, orderId) => {`
    );
}

// Add to createOrder method
code = code.replace(
    `if (order.paymentMethod === 'cashfree') {
        return createCashfreeOrder(userId, order);
    }`,
    `if (order.paymentMethod === 'cashfree') {
        return createCashfreeOrder(userId, order);
    }
    if (order.paymentMethod === 'stripe') {
        return createStripeOrder(userId, order);
    }
    if (order.paymentMethod === 'payu') {
        return createPayUOrder(userId, order);
    }`
);

// Add to verifyPayment method
code = code.replace(
    `if (order.paymentMethod === 'cashfree') {
        return verifyCashfreePayment(userId, orderId);
    }`,
    `if (order.paymentMethod === 'cashfree') {
        return verifyCashfreePayment(userId, orderId);
    }
    if (order.paymentMethod === 'stripe') {
        return verifyStripePayment(userId, orderId, paymentData.session_id);
    }`
);

// Add to exports
code = code.replace(
    'module.exports = { createOrder, verifyPayment, handleWebhook, handleCashfreeWebhook, confirmCodPayment, getGatewayStatuses, saveGatewayCredentials };',
    'module.exports = { createOrder, verifyPayment, handleWebhook, handleCashfreeWebhook, handleStripeWebhook, handlePayUReturn, confirmCodPayment, getGatewayStatuses, saveGatewayCredentials };'
);

// Remove comingSoon flag from gateway status
code = code.replace(/comingSoon: true, \/\/ backend integration pending/g, '');

fs.writeFileSync(file, code);
console.log('Patched payment.service.js');
