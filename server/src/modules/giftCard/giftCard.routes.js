'use strict';

const router = require('express').Router();
const Joi = require('joi');
const { success } = require('../../utils/response');
const { validate } = require('../../middleware/validate.middleware');
const { createLimiter } = require('../../middleware/rateLimiter.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { featureGate } = require('../../middleware/featureGate.middleware');
const AppError = require('../../utils/AppError');
const service = require('./giftCard.service');

const limit = createLimiter(15, 30, 'Too many gift card requests. Try again later.', { prefix: 'gift-cards' });
const { isGuestSessionId } = require('../../utils/guestSession');
const statusLimit = createLimiter(1, 30, 'Too many status requests.', { prefix: 'gift-card-status' });
const admin = [authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE)];
const endpoint = (handler) => async (req, res, next) => {
    try {
        res.set('Cache-Control', 'no-store');
        return success(res, await handler(req));
    } catch (error) { next(error); }
};
const email = Joi.string().trim().lowercase().email().max(254);
const id = Joi.string().uuid().required();
const amount = Joi.number().integer().min(1).max(1000000);

router.get('/policy', endpoint(async () => {
    const [policy, availability] = await Promise.all([
        service.policy(), service.one('SELECT EXISTS (SELECT 1 FROM gift_cards WHERE NOT revoked) AS redeemable'),
    ]);
    return { ...policy, redeemable: availability.redeemable };
}));
router.post('/purchases', limit, featureGate('payments'), validate(Joi.object({
    amount: amount.required(), buyerEmail: email.required(), recipientEmail: email.required(),
    senderName: Joi.string().trim().max(100).allow('').default(''),
    message: Joi.string().trim().max(500).allow('').default(''),
    expectedValidityDays: Joi.number().integer().allow(null).required(),
    deliveryDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
})), endpoint((req) => service.purchase(req.validated)));
const purchaseAccess = Joi.object({ id, token: Joi.string().hex().length(64).required() });
router.post('/status', statusLimit, validate(purchaseAccess),
    endpoint((req) => service.purchaseStatus(req.validated.id, req.validated.token)));
router.post('/resume', limit, validate(purchaseAccess), endpoint((req) => service.resume(req.validated)));
router.post('/verify', limit, validate(purchaseAccess.keys({
    paymentId: Joi.string().pattern(/^pay_[A-Za-z0-9]+$/).max(80).required(),
})), endpoint((req) => service.verify(req.validated)));
const guestSession = (req) => {
    const session = req.headers['x-session-id'] || req.cookies?.sessionId;
    if (!isGuestSessionId(session)) throw new AppError('UNAUTHORIZED', 401, 'A valid guest checkout session is required.');
    return session;
};
router.post('/guest-payment', limit, featureGate('payments'), featureGate('guestCheckout'),
    validate(Joi.object({ orderId: id })),
    endpoint((req) => require('../payment/payment.service').createOrder(null, req.validated.orderId, guestSession(req))));
router.post('/guest-verify/:id', limit, featureGate('payments'), featureGate('guestCheckout'),
    validate(Joi.object({ id }), 'params'),
    validate(require('../payment/payment.validation').verifyPaymentSchema),
    endpoint((req) => require('../payment/payment.service').verifyRazorpayPayment(null, req.params.id, req.validated, guestSession(req))));
router.post('/balance', limit, validate(Joi.object({ code: Joi.string().hex().length(36).required() })),
    endpoint(async (req) => {
        const card = await service.findCard(req.validated.code);
        return { available: card.balance - card.held, suffix: card.suffix };
    }));
router.put('/admin/policy', ...admin, validate(Joi.object({
    enabled: Joi.boolean().required(), minimum: amount.required(),
    maximum: amount.min(Joi.ref('minimum')).required(),
    validityDays: Joi.number().integer().min(1).max(36500).allow(null).required(),
})), endpoint((req) => service.one(`UPDATE gift_card_policy SET enabled = $enabled, minimum = $minimum,
    maximum = $maximum, validity_days = $validityDays WHERE id = 1 RETURNING *`, req.validated)));
router.get('/admin/health', ...admin, endpoint(() => service.one(`SELECT
    (SELECT count(*)::int FROM gift_card_purchases p WHERE captured_at IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM gift_cards c WHERE c.purchase_id = p.id)) AS missing_issuance,
    (SELECT count(*)::int FROM gift_card_deliveries d JOIN gift_cards c ON c.purchase_id = d.purchase_id
        AND NOT c.revoked AND NOT c.suspended WHERE d.status = 'pending' AND d.due_at < now() - interval '5 minutes') AS overdue_delivery,
    (SELECT count(*)::int FROM gift_card_deliveries WHERE status IN ('failed', 'bounced')) AS delivery_review,
    (SELECT count(*)::int FROM gift_card_purchases WHERE refund_status IN ('failed', 'pending')) AS refund_review,
    (SELECT count(*)::int FROM gift_cards c WHERE c.balance <> (SELECT COALESCE(sum(balance_delta), 0)
        FROM gift_card_ledger WHERE card_id = c.id) OR c.held <> (SELECT COALESCE(sum(hold_delta), 0)
        FROM gift_card_ledger WHERE card_id = c.id)) AS ledger_discrepancies`)));
router.get('/admin/cards', ...admin, validate(Joi.object({
    search: Joi.string().trim().max(36).pattern(/^[0-9a-f-]+$/i).allow('').default(''),
}), 'query'), endpoint((req) => service.query(`SELECT p.id, p.amount, p.captured_at, p.refund_status, p.provider_refund, p.provider_order, p.due_at,
    c.id AS card_id, c.suffix, c.balance, c.held, c.expires_at, c.suspended, d.status AS delivery_status, d.attempts AS delivery_attempts, d.sent_at
    FROM gift_card_purchases p LEFT JOIN gift_cards c ON c.purchase_id = p.id AND NOT c.revoked
    LEFT JOIN gift_card_deliveries d ON d.purchase_id = p.id AND d.kind = 'recipient'
    WHERE $search = '' OR p.id::text ILIKE '%' || $search || '%' OR c.suffix ILIKE '%' || $search || '%'
    ORDER BY p.created_at DESC LIMIT 100`, { search: req.query.search })));
router.get('/admin/card/:id', ...admin, validate(Joi.object({ id }), 'params'), endpoint((req) => service.query(
    'SELECT kind, reference, balance_delta, hold_delta, actor_id, reason, created_at FROM gift_card_ledger WHERE card_id = $id ORDER BY id',
    { id: req.params.id })));
router.get('/admin/reconciliation', ...admin, endpoint(() => service.query(`SELECT c.id, c.suffix, c.balance, c.held, p.id AS purchase_id, p.amount AS purchase_amount,
    p.provider_payment, p.captured_at, p.refund_status, p.provider_refund,
    c.revoked, c.expires_at, SUM(l.balance_delta)::integer AS ledger_balance, SUM(l.hold_delta)::integer AS ledger_held,
    COALESCE(SUM(-l.balance_delta) FILTER (WHERE l.kind = 'capture'), 0)::integer AS redeemed,
    COALESCE(SUM(l.balance_delta) FILTER (WHERE l.kind = 'refund'), 0)::integer AS restored
    FROM gift_cards c JOIN gift_card_purchases p ON c.purchase_id = p.id
    LEFT JOIN gift_card_ledger l ON c.id = l.card_id GROUP BY c.id, p.id ORDER BY c.id`)));
router.post('/recipient', limit, validate(purchaseAccess.keys({ recipientEmail: email.required() })),
    endpoint((req) => service.changeDelivery(req.validated)));
router.post('/admin/delivery', ...admin, validate(Joi.object({
    id, recipientEmail: email, reason: Joi.string().trim().min(3).max(250).required(),
})), endpoint((req) => service.changeDelivery({ ...req.validated, actor: req.user.id })));
router.post('/admin/refund', ...admin, authorizePermissions(PERMISSIONS.ORDERS_REFUND), validate(Joi.object({
    id, reason: Joi.string().trim().min(3).max(250).required(),
})), endpoint((req) => service.refundPurchase({ ...req.validated, actor: req.user.id })));
router.post('/admin/suspension', ...admin, validate(Joi.object({
    id, suspended: Joi.boolean().required(), reason: Joi.string().trim().min(3).max(250).required(),
})), endpoint(async (req) => {
    const { sequelize } = require('../index');
    return sequelize.transaction(async (transaction) => {
        const card = await service.one('UPDATE gift_cards SET suspended = $suspended WHERE id = $id AND NOT revoked RETURNING id',
            { id: req.validated.id, suspended: req.validated.suspended }, transaction);
        if (!card) throw new AppError('NOT_FOUND', 404, 'Gift card not found.');
        await service.entry(card.id, req.validated.suspended ? 'suspend' : 'resume',
            require('node:crypto').randomUUID(), 0, 0, transaction, req.user.id, req.validated.reason);
        return card;
    });
}));

module.exports = router;
