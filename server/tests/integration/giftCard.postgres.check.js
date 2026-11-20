'use strict';

// Run against a migrated disposable development database with a test encryption key.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

if (!/^ecommerce_gift_verify(?:_[a-z0-9]+)?$/.test(process.env.DB_NAME || '')) {
    throw new Error('Set DB_NAME to a disposable ecommerce_gift_verify database.');
}
const { sequelize } = require('../../src/modules');
const gifts = require('../../src/modules/giftCard/giftCard.service');
const { decrypt } = require('../../src/utils/crypto');
const email = require('../../src/modules/notification/channels/email.channel');

async function run() {
    const id = randomUUID();
    const token = 'a'.repeat(64);
    const { enabled, minimum, maximum } = await gifts.policy();
    assert.deepEqual({ enabled, minimum, maximum }, { enabled: false, minimum: 500, maximum: 5000 });
    assert.equal(gifts.deliveryDate('2026-11-20', Date.parse('2026-11-19T12:00:00Z')).toISOString(), '2026-11-20T03:30:00.000Z');
    assert.throws(() => gifts.deliveryDate('2026-11-31', Date.parse('2026-11-19T12:00:00Z')));
    await gifts.query(`INSERT INTO gift_card_purchases
        (id, token_digest, buyer_email, recipient_email, sender_name, message, amount, provider_order)
        VALUES ($id, $token, 'buyer@example.org', 'original@example.org', 'Sender', 'Enjoy!', 100000, $provider)`,
    { id, token: gifts.digest('gift-purchase', token), provider: 'order_' + id });
    const payment = { id: 'pay_' + id, order_id: 'order_' + id, amount: 100000, currency: 'INR', status: 'captured' };
    await assert.rejects(() => gifts.capture(id, { ...payment, amount: 1 }));
    await gifts.failed(id, payment.order_id);
    assert.equal((await gifts.purchaseStatus(id, token)).payment, 'failed');
    await Promise.all([gifts.capture(id, payment), gifts.capture(id, payment)]);
    await gifts.failed(id, payment.order_id);
    assert.equal((await gifts.purchaseStatus(id, token)).payment, 'confirmed');
    const card = await gifts.one('SELECT id, code_cipher FROM gift_cards WHERE purchase_id = $id', { id });
    assert.equal((await gifts.one('SELECT count(*)::int AS count FROM gift_cards WHERE purchase_id = $id', { id })).count, 1);
    const code = decrypt(card.code_cipher);
    await assert.rejects(() => gifts.changeDelivery({ id, token, recipientEmail: 'new@example.org' }), /buyer email/);
    await gifts.changeDelivery({ id, token: gifts.digest('gift-buyer-email', id), recipientEmail: 'new@example.org' });

    const delivered = [];
    email.send = async (payload) => { delivered.push(payload); };
    await Promise.all([gifts.deliverOne(), gifts.deliverOne()]);
    assert.equal(delivered.length, 2);
    assert.ok(delivered.some((message) => message.to === 'new@example.org' && message.text.includes(code)));
    assert.ok(delivered.some((message) => message.to === 'buyer@example.org' && !message.text.includes(code)));
    await assert.rejects(() => gifts.changeDelivery({ id, token: gifts.digest('gift-buyer-email', id), recipientEmail: 'newer@example.org' }));

    await gifts.query('UPDATE gift_cards SET suspended = true WHERE id = $id', { id: card.id });
    await assert.rejects(() => gifts.changeDelivery({
        id, actor: randomUUID(), recipientEmail: 'alternate@example.org', reason: 'Review suspended card',
    }), /recipient cannot be changed/);
    await gifts.query('UPDATE gift_cards SET suspended = false WHERE id = $id', { id: card.id });

    const orderIds = [randomUUID(), randomUUID(), randomUUID()];
    for (const orderId of orderIds) {
        await gifts.query(`INSERT INTO orders (id, order_number, subtotal, total, payment_method)
            VALUES ($id, $id::uuid::text, 1000, 1000, 'razorpay')`, { id: orderId });
    }
    await Promise.all(orderIds.slice(0, 2).map((orderId) => sequelize.transaction(async (transaction) => {
        const active = await gifts.findCard(code, transaction);
        const amount = Math.min(70000, active.balance - active.held);
        await gifts.reserve({ id: orderId }, active, amount, false, transaction);
    })));
    await assert.rejects(() => gifts.findCard(code));
    const [firstId, secondId, thirdId] = orderIds;
    const held = await gifts.one('SELECT balance, held FROM gift_cards WHERE id = $id', { id: card.id });
    assert.deepEqual(held, { balance: 100000, held: 100000 });
    await sequelize.transaction(async (transaction) => {
        await gifts.settle(firstId, 'captured', transaction);
        await gifts.settle(firstId, 'captured', transaction);
        await gifts.settle(secondId, 'released', transaction);
        await gifts.settle(secondId, 'captured', transaction);
        assert.equal(await gifts.refundAllocation(secondId, 20000, transaction), 0);
        const active = await gifts.findCard(code, transaction);
        await gifts.reserve({ id: thirdId }, active, 10000, true, transaction);
        const refundAmount = await gifts.refundAllocation(thirdId, 90000, transaction);
        assert.equal(refundAmount, 10000);
        await gifts.restore(thirdId, { id: randomUUID(), reason: 'Test return', metadata: { giftCardRefundPaise: refundAmount } }, null, transaction);
        assert.equal(await gifts.refundAllocation(thirdId, 10000, transaction), 0);
    });
    const balances = await gifts.one(`SELECT c.balance, c.held, sum(l.balance_delta)::int AS ledger_balance,
        sum(l.hold_delta)::int AS ledger_held FROM gift_cards c JOIN gift_card_ledger l ON l.card_id = c.id
        WHERE c.id = $id GROUP BY c.id`, { id: card.id });
    assert.equal(balances.balance, balances.ledger_balance);
    assert.equal(balances.held, 0);
    assert.equal(balances.ledger_held, 0);
    const scheduled = randomUUID();
    const scheduledPayment = { ...payment, id: 'pay_' + scheduled, order_id: 'order_' + scheduled };
    await gifts.query(`INSERT INTO gift_card_purchases
        (id, token_digest, buyer_email, recipient_email, sender_name, message, amount, due_at, provider_order)
        VALUES ($id, $token, 'buyer@example.org', 'scheduled@example.org', '', '', 100000, now() + interval '1 day', $provider)`,
    { id: scheduled, token: gifts.digest('gift-purchase', token), provider: scheduledPayment.order_id });
    await gifts.capture(scheduled, scheduledPayment);
    await gifts.deliverOne();
    assert.equal(await gifts.deliverOne(), false);
    await gifts.query("UPDATE gift_card_deliveries SET due_at = now() WHERE purchase_id = $id AND kind = 'recipient'", { id: scheduled });
    email.send = async () => { throw Object.assign(new Error('Mailbox unavailable'), { responseCode: 550 }); };
    await gifts.deliverOne();
    assert.equal((await gifts.purchaseStatus(scheduled, token)).delivery, 'bounced');
    await gifts.query('UPDATE gift_card_purchases SET due_at = now() WHERE id = $id', { id: scheduled });
    await gifts.changeDelivery({ id: scheduled, token: gifts.digest('gift-buyer-email', scheduled), recipientEmail: 'fixed@example.org' });
    email.send = async (payload) => { delivered.push(payload); };
    await gifts.deliverOne();
    assert.equal((await gifts.purchaseStatus(scheduled, token)).delivery, 'sent');
    assert.equal(delivered.at(-1).to, 'fixed@example.org');
    const { Setting } = require('../../src/modules');
    await Setting.upsert({ group: 'general', key: 'currency', value: 'INR' });
    const manual = {
        id: randomUUID(), actor: randomUUID(), reason: 'Customer goodwill',
        amount: 500, recipientEmail: 'manual@example.org', message: 'Thank you',
    };
    await Promise.all([gifts.issueManually(manual), gifts.issueManually(manual)]);
    await assert.rejects(() => gifts.issueManually({ ...manual, amount: 600 }), /already used/);
    const manualCard = await gifts.one(`SELECT c.id, l.actor_id, l.reason, p.captured_at
        FROM gift_cards c JOIN gift_card_purchases p ON p.id = c.purchase_id
        JOIN gift_card_ledger l ON l.card_id = c.id AND l.kind = 'manual_issue' WHERE p.id = $id`, manual);
    assert.equal(manualCard.actor_id, manual.actor);
    assert.equal(manualCard.reason, manual.reason);
    assert.equal(manualCard.captured_at, null);
    await assert.rejects(() => gifts.refundPurchase(manual));
    await gifts.deliverOne();
    const firstMessage = delivered.at(-1);
    assert.equal(firstMessage.to, manual.recipientEmail);
    assert.ok(!firstMessage.text.includes(manual.reason));
    const deliveryStatus = () => gifts.one("SELECT status FROM gift_card_deliveries WHERE purchase_id = $id AND kind = 'recipient'", manual);
    await gifts.recordBounce(firstMessage.messageId);
    await gifts.recordBounce(firstMessage.messageId);
    assert.equal((await deliveryStatus()).status, 'bounced');
    await gifts.changeDelivery({ ...manual, recipientEmail: undefined });
    await gifts.deliverOne();
    await gifts.recordBounce(firstMessage.messageId);
    assert.equal((await deliveryStatus()).status, 'sent');
    await gifts.recordBounce(delivered.at(-1).messageId);
    assert.equal((await deliveryStatus()).status, 'bounced');
    console.log('Gift card issuance, scheduled email, bounce recovery, checkout holds, late settlement, refunds and ledger reconciliation passed.');
}

run().catch((error) => {
    console.error(error.message, error.original?.message || '');
    process.exitCode = 1;
}).finally(() => sequelize.close());
