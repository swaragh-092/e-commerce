'use strict';

const { createHmac, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { sequelize } = require('../index');
const { encrypt, decrypt } = require('../../utils/crypto');
const AppError = require('../../utils/AppError');

const day = 86400000;
const query = async (sql, bind = {}, transaction) => {
    const [rows] = await sequelize.query(sql, { bind, transaction, logging: false });
    return rows;
};
const one = async (...args) => (await query(...args))[0];
const digest = (purpose, value) => {
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!key) throw new AppError('GIFT_CARD_UNAVAILABLE', 503, 'Gift cards are unavailable.');
    return createHmac('sha256', key).update(purpose + ':' + value).digest('hex');
};
const buyerToken = (id) => digest('gift-buyer-email', id);
const validBuyerToken = (id, token) => Boolean(token && timingSafeEqual(Buffer.from(buyerToken(id), 'hex'), Buffer.from(token, 'hex')));
const codeDigest = (code) => digest('gift-card', code.trim().toUpperCase());
const policy = (transaction) => one('SELECT enabled, minimum, maximum, validity_days FROM gift_card_policy WHERE id = 1', {}, transaction);

function deliveryDate(date, now = Date.now()) {
    if (!date) return null;
    const timestamp = new Date(date + 'T09:00:00+05:30');
    const localDay = new Date(now + 19800000).toISOString().slice(0, 10);
    const valid = Number.isFinite(+timestamp) && new Date(+timestamp + 19800000).toISOString().slice(0, 10) === date;
    if (!valid || date < localDay || +timestamp > now + 90 * day) {
        throw new AppError('INVALID_DELIVERY_DATE', 400, 'Choose a delivery date within the next 90 days.');
    }
    return timestamp;
}

async function purchase(input) {
    const settings = await policy();
    if (!settings.enabled) throw new AppError('GIFT_CARD_UNAVAILABLE', 403, 'Gift card sales are paused.');
    if (input.amount < settings.minimum || input.amount > settings.maximum) {
        throw new AppError('INVALID_GIFT_CARD_AMOUNT', 400, 'Choose an amount within the store limits.');
    }
    const id = randomUUID();
    const token = randomBytes(32).toString('hex');
    if (input.expectedValidityDays !== settings.validity_days) {
        throw new AppError('GIFT_CARD_TERMS_CHANGED', 409, 'The gift card terms changed. Review the new policy before paying.');
    }
    const shop = await require('../settings/settings.service').getByGroup('general');
    if (String(shop.currency || 'INR').toUpperCase() !== 'INR') {
        throw new AppError('GIFT_CARD_UNAVAILABLE', 403, 'This merchant does not sell INR gift cards.');
    }
    const amount = input.amount * 100;
    const due = deliveryDate(input.deliveryDate);
    const paymentSettings = await require('../settings/settings.service').getByGroup('payments');
    if (paymentSettings.razorpayEnabled === false || paymentSettings.razorpayEnabled === 'false') {
        throw new AppError('GIFT_CARD_UNAVAILABLE', 503, 'Gift card payments are unavailable.');
    }
    const payments = require('../payment/payment.service');
    const gateway = await payments.getRazorpayClient();
    const keyId = await payments.getCredential('razorpay.keyId', 'RAZORPAY_KEY_ID');
    if (!await payments.getCredential('razorpay.webhookSecret', 'RAZORPAY_WEBHOOK_SECRET')) {
        throw new AppError('GIFT_CARD_UNAVAILABLE', 503, 'Gift card payments are unavailable.');
    }
    await query(`INSERT INTO gift_card_purchases
        (id, token_digest, buyer_email, recipient_email, sender_name, message, amount, due_at, validity_days)
        VALUES ($id, $token, $buyerEmail, $recipientEmail, $senderName, $message, $amount, $due, $validity)`,
    { ...input, id, token: digest('gift-purchase', token), amount, due, validity: settings.validity_days });
    const order = await gateway.orders.create({ amount, currency: 'INR', receipt: id, notes: { giftCardPurchaseId: id } });
    await query('UPDATE gift_card_purchases SET provider_order = $order WHERE id = $id', { order: order.id, id });
    return { id, token, providerOrder: order.id, amount, keyId };
}

async function entry(card, kind, reference, balance, held, transaction, actor = null, reason = null) {
    await query(`INSERT INTO gift_card_ledger (card_id, kind, reference, balance_delta, hold_delta, actor_id, reason)
        VALUES ($card, $kind, $reference, $balance, $held, $actor, $reason)`,
    { card, kind, reference, balance, held, actor, reason }, transaction);
}

async function createCard(purchase, balance, expires, transaction) {
    const id = randomUUID();
    const code = randomBytes(18).toString('hex').toUpperCase();
    await query(`INSERT INTO gift_cards (id, purchase_id, digest, code_cipher, suffix, balance, expires_at)
        VALUES ($id, $purchase, $digest, $cipher, $suffix, $balance, $expires)`,
    { id, purchase, digest: codeDigest(code), cipher: JSON.stringify(encrypt(code)), suffix: code.slice(-4), balance, expires }, transaction);
    return id;
}

async function issueManually({ id, actor, reason, amount, recipientEmail, message }) {
    const shop = await require('../settings/settings.service').getByGroup('general');
    if (String(shop.currency || 'INR').toUpperCase() !== 'INR') {
        throw new AppError('GIFT_CARD_UNAVAILABLE', 403, 'Manual gift cards require an INR store.');
    }
    const paise = amount * 100;
    const requestDigest = digest('manual-gift-card', JSON.stringify([actor, id, reason, amount, recipientEmail, message]));
    return sequelize.transaction(async (transaction) => {
        const existing = await one('SELECT issued_manually, token_digest FROM gift_card_purchases WHERE id = $id', { id }, transaction);
        const settings = await policy(transaction);
        if (!existing && (amount < settings.minimum || amount > settings.maximum)) {
            throw new AppError('INVALID_GIFT_CARD_AMOUNT', 400, 'Choose an amount within the store limits.');
        }
        const issued = await one(`INSERT INTO gift_card_purchases
            (id, token_digest, buyer_email, recipient_email, sender_name, message, amount, validity_days, issued_manually)
            VALUES ($id, $token, $recipientEmail, $recipientEmail, '', $message, $amount, $validity, true)
            ON CONFLICT (id) DO NOTHING RETURNING created_at`,
        { id, token: requestDigest, recipientEmail, message, amount: paise, validity: settings.validity_days }, transaction);
        if (!issued) {
            const prior = existing || await one('SELECT issued_manually, token_digest FROM gift_card_purchases WHERE id = $id', { id }, transaction);
            if (prior?.issued_manually && prior.token_digest === requestDigest) return { id };
            throw new AppError('GIFT_CARD_REQUEST_CONFLICT', 409, 'This issuance request was already used.');
        }
        const expiry = settings.validity_days ? new Date(+issued.created_at + settings.validity_days * day) : null;
        const card = await createCard(id, paise, expiry, transaction);
        await entry(card, 'manual_issue', id, paise, 0, transaction, actor, reason);
        await query("INSERT INTO gift_card_deliveries (purchase_id, kind, due_at) VALUES ($id, 'recipient', now())", { id }, transaction);
        return { id };
    });
}

async function recordBounce(messageId) {
    const normalized = messageId.replace(/^<|>$/g, '');
    const match = /^gift-(recipient|receipt)-([a-f0-9-]{36})-[a-f0-9]{32}@[a-z0-9.-]+$/i.exec(normalized);
    if (!match || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(match[2])) return;
    const [, kind, id] = match;
    await sequelize.transaction(async (transaction) => {
        const delivery = await one('SELECT status, message_id FROM gift_card_deliveries WHERE purchase_id = $id AND kind = $kind FOR UPDATE',
            { id, kind }, transaction);
        if (delivery?.status !== 'sent' || delivery.message_id !== normalized) return;
        await query("UPDATE gift_card_deliveries SET status = 'bounced' WHERE purchase_id = $id AND kind = $kind",
            { id, kind }, transaction);
    });
}

async function capture(id, payment) {
    return sequelize.transaction(async (transaction) => {
        const purchase = await one('SELECT * FROM gift_card_purchases WHERE id = $id FOR UPDATE', { id }, transaction);
        if (!purchase || !payment.id || !payment.order_id || payment.order_id !== purchase.provider_order || payment.currency !== 'INR'
            || Number(payment.amount) !== purchase.amount || payment.status !== 'captured') {
            throw new AppError('INVALID_GIFT_CARD_PAYMENT', 400, 'Gift card payment could not be verified.');
        }
        if (purchase.provider_payment === payment.id) return;
        if (purchase.provider_payment) throw new AppError('GIFT_CARD_DUPLICATE_CAPTURE', 409, 'Gift card purchase needs payment review.');
        const due = purchase.due_at || new Date();
        const expiry = purchase.validity_days ? new Date(+due + purchase.validity_days * day) : null;
        const card = await createCard(id, purchase.amount, expiry, transaction);
        await entry(card, 'issue', id, purchase.amount, 0, transaction);
        await query('UPDATE gift_card_purchases SET provider_payment = $payment, captured_at = now() WHERE id = $id',
            { payment: payment.id, id }, transaction);
        await query(`INSERT INTO gift_card_deliveries (purchase_id, kind, due_at)
            VALUES ($id, 'recipient', $due), ($id, 'receipt', now())`, { id, due }, transaction);
    });
}

async function purchaseStatus(id, token) {
    const status = await one(`SELECT p.captured_at, p.failed_at, p.refund_status, p.provider_order, p.due_at, d.status AS delivery_status
        FROM gift_card_purchases p LEFT JOIN gift_card_deliveries d ON d.purchase_id = p.id AND d.kind = 'recipient'
        WHERE p.id = $id AND (p.token_digest = $token OR $verified)`, { id, token: digest('gift-purchase', token), verified: validBuyerToken(id, token) });
    if (!status) throw new AppError('NOT_FOUND', 404, 'Gift card purchase not found.');
    return { payment: status.captured_at ? 'confirmed' : status.provider_order && !status.failed_at ? 'pending' : 'failed',
        refund: status.refund_status, delivery: status.delivery_status, dueAt: status.due_at };
}

async function verify({ id, token, paymentId }) {
    await purchaseStatus(id, token);
    const gateway = await require('../payment/payment.service').getRazorpayClient();
    const payment = await gateway.payments.fetch(paymentId);
    if (payment.status === 'captured') await capture(id, payment);
    if (payment.status === 'failed') await failed(id, payment.order_id);
    return purchaseStatus(id, token);
}

async function resume({ id, token }) {
    const status = await purchaseStatus(id, token);
    if (status.payment === 'confirmed') throw new AppError('GIFT_CARD_ALREADY_PAID', 409, 'This gift card purchase is already paid.');
    const purchase = await one('SELECT amount, provider_order FROM gift_card_purchases WHERE id = $id', { id });
    if (!purchase.provider_order) throw new AppError('PAYMENT_UNAVAILABLE', 409, 'Start a new purchase to pay for this gift card.');
    const payments = require('../payment/payment.service');
    const gateway = await payments.getRazorpayClient();
    const attempts = await gateway.orders.fetchPayments(purchase.provider_order);
    const captured = attempts.items?.find((attempt) => attempt.status === 'captured');
    if (captured) {
        await capture(id, captured);
        return { settled: true };
    }
    const keyId = await payments.getCredential('razorpay.keyId', 'RAZORPAY_KEY_ID');
    return { id, token, providerOrder: purchase.provider_order, amount: purchase.amount, keyId };
}

const purchaseForProviderOrder = (order) => one(
    'SELECT id FROM gift_card_purchases WHERE provider_order = $order', { order }
);

async function dispute(paymentId, disputeId) {
    return sequelize.transaction(async (transaction) => {
        const purchase = await one('SELECT id FROM gift_card_purchases WHERE provider_payment = $payment FOR UPDATE', { payment: paymentId }, transaction);
        if (!purchase) return false;
        const card = await one('UPDATE gift_cards SET suspended = true WHERE purchase_id = $id AND NOT revoked RETURNING id', purchase, transaction);
        if (card) await query(`INSERT INTO gift_card_ledger (card_id, kind, reference, reason)
            VALUES ($card, 'dispute', $reference, 'Provider dispute opened') ON CONFLICT DO NOTHING`,
        { card: card.id, reference: disputeId }, transaction);
        return true;
    });
}

async function failed(id, order) {
    await query(`UPDATE gift_card_purchases SET failed_at = now()
        WHERE id = $id AND provider_order = $order AND captured_at IS NULL`, { id, order });
}

async function updatePurchaseRefund(purchase) {
    const result = await require('../payment/payment.service').fetchProviderRefundStatus({
        payment: { provider: 'razorpay', transactionId: purchase.provider_payment },
        refund: { id: purchase.id, providerRefundId: purchase.provider_refund },
    });
    if (result.status === 'pending' || !result.status) return;
    await query(`UPDATE gift_card_purchases SET refund_status = $status, provider_refund = $provider
        WHERE id = $id AND refund_status = 'pending'`,
    { id: purchase.id, status: result.status, provider: result.providerRefundId || null });
}

async function refundPurchase({ id, actor, reason }) {
    const purchase = await sequelize.transaction(async (transaction) => {
        const purchase = await one('SELECT * FROM gift_card_purchases WHERE id = $id FOR UPDATE', { id }, transaction);
        if (!purchase?.provider_payment || purchase.refund_status) {
            throw new AppError('GIFT_CARD_REFUND_REVIEW', 409, 'Check the existing purchase and refund status.');
        }
        await one("SELECT purchase_id FROM gift_card_deliveries WHERE purchase_id = $id AND kind = 'recipient' FOR UPDATE", { id }, transaction);
        const card = await one('SELECT * FROM gift_cards WHERE purchase_id = $id AND NOT revoked FOR UPDATE', { id }, transaction);
        const spent = card && await one("SELECT 1 FROM gift_card_ledger WHERE card_id = $id AND kind IN ('capture', 'replace') LIMIT 1",
            { id: card.id }, transaction);
        if (!card || card.balance !== purchase.amount || card.held || spent) {
            throw new AppError('GIFT_CARD_REFUND_REVIEW', 409, 'Finance must review spent or reserved cards.');
        }
        await query('UPDATE gift_cards SET revoked = true, balance = 0 WHERE id = $id', { id: card.id }, transaction);
        await entry(card.id, 'revoke', id, -card.balance, 0, transaction, actor, reason);
        await query("UPDATE gift_card_purchases SET refund_status = 'pending', refund_requested_at = now() WHERE id = $id", { id }, transaction);
        return purchase;
    });
    try {
        const result = await require('../payment/payment.service').initiateProviderRefund({
            payment: { provider: 'razorpay', transactionId: purchase.provider_payment },
            order: { id },
            refundId: id, amount: purchase.amount / 100, reason,
        });
        await query(`UPDATE gift_card_purchases SET refund_status = $status, provider_refund = $provider
            WHERE id = $id AND refund_status = 'pending'`,
        { id, status: result.status, provider: result.providerRefundId || null });
        return { status: result.status };
    } catch {
        return { status: 'pending', reviewRequired: true };
    }
}

async function reconcilePurchaseRefunds() {
    const purchases = await query(`SELECT id, provider_payment, provider_refund FROM gift_card_purchases
        WHERE refund_status = 'pending' AND refund_requested_at < now() - interval '1 minute'
        ORDER BY refund_requested_at LIMIT 20`);
    for (const purchase of purchases) {
        try {
            await updatePurchaseRefund(purchase);
        } catch {
            // Leave the refund reserved for provider reconciliation.
        } finally {
            await query("UPDATE gift_card_purchases SET refund_requested_at = now() WHERE id = $id AND refund_status = 'pending'", { id: purchase.id });
        }
    }
}

async function findCard(code, transaction) {
    const card = await one(`SELECT c.id, c.balance, c.held, c.suffix FROM gift_cards c
        WHERE c.digest = $digest AND NOT c.revoked AND NOT c.suspended
        AND EXISTS (SELECT 1 FROM gift_card_purchases p WHERE p.id = c.purchase_id AND (p.due_at IS NULL OR p.due_at <= now()))
        AND (c.expires_at IS NULL OR c.expires_at > now())` + (transaction ? ' FOR UPDATE' : ''),
    { digest: codeDigest(code) }, transaction);
    if (!card || card.balance <= card.held) throw new AppError('GIFT_CARD_INVALID', 422, 'This gift card is unavailable or has no available balance.');
    return card;
}

async function reserve(order, card, amount, settled, transaction) {
    if (!amount) return;
    const orderId = order.id;
    await query(`INSERT INTO gift_card_tenders (order_id, card_id, amount, state)
        VALUES ($orderId, $card, $amount, 'held')`, { orderId, card: card.id, amount }, transaction);
    await query('UPDATE gift_cards SET held = held + $amount WHERE id = $id', { id: card.id, amount }, transaction);
    await entry(card.id, 'hold', orderId, 0, amount, transaction);
    if (settled) await settle(orderId, 'captured', transaction);
}

async function settle(orderId, state, transaction) {
    const tender = await one(`UPDATE gift_card_tenders SET state = $state
        WHERE order_id = $orderId AND state = 'held' RETURNING card_id, amount`, { orderId, state }, transaction);
    if (!tender) return;
    const debit = state === 'captured' ? tender.amount : 0;
    await query('UPDATE gift_cards SET held = held - $amount, balance = balance - $debit WHERE id = $id',
        { id: tender.card_id, amount: tender.amount, debit }, transaction);
    await entry(tender.card_id, state === 'captured' ? 'capture' : 'release', orderId, -debit, -tender.amount, transaction);
}

async function refundAllocation(orderId, amount, transaction) {
    const tender = await one(`SELECT t.*, c.revoked, c.expires_at FROM gift_card_tenders t
        JOIN gift_cards c ON c.id = t.card_id WHERE order_id = $orderId AND t.state = 'captured'`,
    { orderId }, transaction);
    if (!tender) return 0;
    const restore = Math.min(amount, tender.amount - tender.restored);
    if (restore && (tender.revoked || (tender.expires_at && +tender.expires_at <= Date.now()))) {
        throw new AppError('GIFT_CARD_REFUND_REVIEW', 409, 'Finance must review this refund because the original card was replaced, revoked or expired.');
    }
    return restore;
}

async function restore(orderId, refund, actor, transaction) {
    const amount = refund.metadata.giftCardRefundPaise;
    const tender = await one(`UPDATE gift_card_tenders SET restored = restored + $amount
        WHERE order_id = $orderId AND state = 'captured' RETURNING card_id`, { orderId, amount }, transaction);
    if (!tender) throw new Error('Refund gift card tender was not captured');
    const original = await one('SELECT purchase_id, revoked FROM gift_cards WHERE id = $id FOR UPDATE', { id: tender.card_id }, transaction);
    const card = original.revoked
        ? await one('SELECT id FROM gift_cards WHERE purchase_id = $id AND NOT revoked FOR UPDATE', { id: original.purchase_id }, transaction)
        : { id: tender.card_id };
    if (!card) throw new Error('Refund gift card requires finance review');
    await query('UPDATE gift_cards SET balance = balance + $amount WHERE id = $id', { id: card.id, amount }, transaction);
    await entry(card.id, 'refund', refund.id, amount, 0, transaction, actor, refund.reason);
}

async function deliverOne() {
    return sequelize.transaction(async (transaction) => {
        const record = await one(`SELECT d.kind, d.attempts, p.*, c.id AS card_id, c.code_cipher, c.balance, c.expires_at, c.suspended
            FROM gift_card_deliveries d JOIN gift_card_purchases p ON p.id = d.purchase_id
            LEFT JOIN gift_cards c ON c.purchase_id = p.id AND NOT c.revoked
            WHERE d.status = 'pending' AND d.due_at <= now()
            AND (d.kind = 'receipt' OR (c.id IS NOT NULL AND NOT c.suspended))
            ORDER BY d.due_at LIMIT 1 FOR UPDATE OF d SKIP LOCKED`, {}, transaction);
        if (!record) return false;
        if (record.kind === 'recipient') {
            const card = await one('SELECT suspended, revoked FROM gift_cards WHERE id = $id FOR UPDATE',
                { id: record.card_id }, transaction);
            if (!card || card.suspended || card.revoked) return false;
        }
        const email = require('../notification/channels/email.channel');
        let state = 'sent';
        let messageId = null;
        try {
            const recipient = record.kind === 'recipient';
            const value = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format((recipient ? record.balance : record.amount) / 100);
            const baseUrl = require('../auth/authRedirects').getClientBaseUrl();
            messageId = 'gift-' + record.kind + '-' + record.id + '-' + randomBytes(16).toString('hex') + '@' + new URL(baseUrl).hostname;
            const statusLink = baseUrl + '/gift-cards#' + record.id + '/' + buyerToken(record.id);
            const expiry = record.expires_at
                ? 'Valid until ' + record.expires_at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST.'
                : 'This card has no expiry.';
            await email.send({
                to: recipient ? record.recipient_email : record.buyer_email,
                subject: recipient ? 'Your digital gift card' : 'Digital gift card purchase confirmed',
                text: recipient
                    ? [record.sender_name ? 'From ' + record.sender_name : '', record.message, value,
                        'Gift card code: ' + decrypt(record.code_cipher), expiry, 'Enter this code in the gift card field at checkout. ' + baseUrl + '/checkout'].filter(Boolean).join('\n\n')
                    : 'Your gift card purchase of ' + value + ' has been confirmed. Track delivery or correct the recipient email: ' + statusLink,
                sensitive: true,
                messageId: '<' + messageId + '>',
            });
        } catch (error) {
            state = Number(error.responseCode) >= 500 && Number(error.responseCode) < 600
                ? 'bounced' : record.attempts >= 4 ? 'failed' : 'pending';
        }
        await query(`UPDATE gift_card_deliveries SET status = $state, attempts = attempts + 1,
            due_at = now() + (attempts + 1) * interval '5 minutes',
            sent_at = CASE WHEN $state = 'sent' THEN now() ELSE sent_at END,
            message_id = CASE WHEN $state = 'sent' THEN $messageId ELSE NULL END
            WHERE purchase_id = $id AND kind = $kind`, { state, messageId, id: record.id, kind: record.kind }, transaction);
        return true;
    });
}

async function changeDelivery({ id, token, actor, recipientEmail, reason }) {
    return sequelize.transaction(async (transaction) => {
        if (!actor && !validBuyerToken(id, token)) {
            throw new AppError('BUYER_EMAIL_VERIFICATION_REQUIRED', 403, 'Open the link sent to your buyer email to update delivery.');
        }
        const delivery = await one(`SELECT d.status, d.sent_at, c.id AS card, c.suspended, c.expires_at, c.balance, c.held
            FROM gift_card_deliveries d JOIN gift_card_purchases p ON p.id = d.purchase_id
            JOIN gift_cards c ON c.purchase_id = p.id AND NOT c.revoked
            WHERE p.id = $id AND d.kind = 'recipient'
            FOR UPDATE OF d, c`, { id }, transaction);
        if (!delivery) throw new AppError('NOT_FOUND', 404, 'Gift card delivery not found.');
        if (delivery.sent_at && recipientEmail) {
            if (!actor || delivery.suspended || delivery.held || delivery.balance <= 0) {
                throw new AppError('GIFT_CARD_DELIVERY_LOCKED', 409, 'The recipient cannot be changed for this delivery.');
            }
            await query('UPDATE gift_cards SET revoked = true, balance = 0 WHERE id = $card',
                { card: delivery.card }, transaction);
            await entry(delivery.card, 'revoke', id, -delivery.balance, 0, transaction, actor, reason);
            const replacement = await createCard(id, delivery.balance, delivery.expires_at, transaction);
            await entry(replacement, 'replace', delivery.card, delivery.balance, 0, transaction, actor, reason);
        } else if (actor) {
            await entry(delivery.card, 'delivery', randomUUID(), 0, 0, transaction, actor, reason);
        }
        if (recipientEmail) await query('UPDATE gift_card_purchases SET recipient_email = $email WHERE id = $id',
            { id, email: recipientEmail }, transaction);
        await query(`UPDATE gift_card_deliveries SET status = 'pending', attempts = 0, message_id = NULL,
            due_at = GREATEST(now(), COALESCE((SELECT due_at FROM gift_card_purchases WHERE id = $id), now()))
            WHERE purchase_id = $id AND kind = 'recipient'`, { id }, transaction);
        return { delivery: 'pending' };
    });
}

module.exports = { issueManually, recordBounce, dispute, resume, purchaseForProviderOrder, verify, failed, refundPurchase, reconcilePurchaseRefunds, restore, refundAllocation, changeDelivery, query, one, policy, purchase, purchaseStatus, capture, findCard, reserve, settle, deliverOne, deliveryDate, digest, entry, createCard };
