# India digital gift cards

Gift cards are INR bearer codes for purchases from the same legal merchant. The storefront is at `/gift-cards` and merchant controls are at `/admin/gift-cards`. New sales start paused. Pausing sales retains redemption, delivery and support for existing cards.

## Staging through launch

1. Run the Sequelize migration, configure a stable `CREDENTIAL_ENCRYPTION_KEY`, and set the public `CLIENT_URL` and merchant SMTP details. Back up the encryption key with the database because encrypted cards and buyer receipt links depend on it.
2. Configure Razorpay test keys and the existing `/api/payments/webhook` with capture, failure and dispute events. Merchants use one issuer and one store database. Verify that payment capture is active and that Razorpay is enabled for checkout.
3. Rehearse immediate and next-day sends, guest and signed-in redemption, full-card and split payment, cancellation, and return refunds. Compare Razorpay capture and refund IDs with the reconciliation export.
4. Obtain India legal and finance approval for the merchant issuer, published terms, GST, invoicing, validity and extensions, refunds, chargebacks, and outstanding liability. Then enable sales in the merchant admin. Default limits are ₹500–₹5,000 with no expiry. Scheduled delivery opens at 9 a.m. IST, up to 90 days ahead.
5. Review the dashboard counters for missing issuance, overdue mail, delivery and refund review, and ledger mismatches. Pause new sales in admin during an incident. Leave the workers and callbacks running to honor existing cards and any captured purchase already in flight.

## Operations

- The recipient email status records SMTP acceptance. Synchronous SMTP 5xx failures are marked bounced. The delayed-bounce webhook can also mark a message as bounced after SMTP acceptance. See the setup below. A worker interruption during SMTP handoff can result in a repeated email with the same card.
- Buyers use the link in their email receipt to prove access to the buyer address for pre-delivery corrections. For a delivered gift, staff can replace the code with an audited transfer of its remaining balance. Confirm the recipient address before submitting a correction.
- Cancelled pending orders release the hold. For paid merchandise cancellations and completed returns, use the existing order refund action. A partial refund credits the gift card first and sends the remaining portion to the original gateway. For expired or replaced originals, escalate to finance before issuing a refund.
- A reviewed refund of an unused gift card purchase revokes the card before contacting the gateway. If the gateway outcome remains pending, verify its refund reference in Razorpay and leave the card disabled pending reconciliation. For disputes or spent cards, review the ledger and gateway dashboard before reinstating value. The gift purchase refund request is deliberately held if the gateway outcome is uncertain to avoid duplicate disbursement.
- Export reconciliation from the admin panel. Values in the export are integer paise. Compare ledger totals with balance and held, then tie purchases, redemptions and refunds back to source IDs.

## Verification

Use `npm --prefix server run test -- --run`, `npm --prefix client test`, and `npm --prefix client run build`. In a disposable migrated development database named `ecommerce_gift_verify`, run `node server/tests/integration/giftCard.postgres.check.js` with the database connection environment and a disposable encryption key.

## Implementation files

- Storefront and checkout — `client/src/pages/storefront/GiftCardPage.jsx`, `CheckoutPage.jsx`, `PaymentPage.jsx`, `client/src/components/layout/StorefrontFooter.jsx`, `client/src/services/paymentService.js`, and `client/src/utils/loadPaymentScript.js`.
- Admin and routing — `client/src/pages/admin/GiftCardsPage.jsx`, `OrderDetailPage.jsx`, `client/src/layouts/AdminLayout.jsx`, and `client/src/routes/AppRoutes.jsx`.
- Gift card API, storage and jobs — `server/src/app.js`, `server/src/modules/giftCard/giftCard.routes.js`, `giftCard.service.js`, `server/migrations/20261119120000-create-gift-cards.js`, `server/src/jobs/index.js`, `giftCardDelivery.job.js`, and `reservationTimeout.job.js`.
- Order and payment lifecycle — `server/src/modules/order/order.model.js`, `order.routes.js`, `order.service.js`, `order.validation.js`, `server/src/modules/payment/payment.service.js`, and `server/src/modules/notification/channels/email.channel.js`.
- Checks — `server/tests/integration/giftCard.postgres.check.js` and `client/src/test/pages/storefront/GiftCardPage.test.jsx`.

## Manual issuance and delayed bounces

Staff with **Issue gift cards** in Access Control can use **Create gift card** in E-commerce mode. **View gift cards** allows read-only access. **Manage gift cards** controls the sales policy, delivery and suspension. **Refund gift card purchases** covers purchase refunds. The Digital Gift Cards switch in Platform Features pauses both new storefront sales and staff issuance while existing E-commerce balances remain redeemable. The card follows the configured amount and validity policy and can be issued while storefront sales are paused. The recipient receives the code by email. The ledger records the staff actor, value and internal reason. Staff-issued cards appear separately in reconciliation and have no purchase refund because no payment was collected. A merchandise order fully covered by gift card value settles without a gateway.

For automatic delayed-bounce reporting, configure a bounce-capable mail provider or its event relay. Have the relay verify the provider event, forward permanent bounces only, and preserve the original RFC Message-ID from the sent email. The event relay posts to `/api/gift-cards/delivery-bounce` with `Authorization: Bearer <GIFT_CARD_BOUNCE_WEBHOOK_SECRET>` and JSON `{"messageId":"<original-message-id>"}`. Set a random secret of at least 32 characters on both ends. The endpoint is disabled without that setting. Duplicate events and events for older send attempts are ignored. This applies to messages sent after the tracking migration. SMTP-only configurations continue to record immediate rejections.
