# Changelog

All notable changes to this project are documented here.

## [1.9.0.0] - 2026-11-20

### Added

- Customize search titles, descriptions, keywords, and sharing images for brands and gallery albums from their admin editors.

### Fixed

- Use saved gallery SEO ahead of preset storefront copy while preserving canonical URLs, image alt text, and public visibility checks.

## [1.8.0.0] - 2026-11-20

### Added

- Let authorized staff issue digital gift cards without collecting payment, with an audited reason and recipient email delivery.
- Register gift card permissions in Access Control and add an E-commerce-only issuance switch in Platform Features.
- Track delayed permanent gift card email bounces through an authenticated mail event relay.

### Fixed

- Require CSRF tokens for browser API writes and cookie-authenticated API writes.

## [1.7.0.0] - 2026-11-20

### Added

- Add INR digital gift cards with scheduled email delivery, checkout redemption, gift card refunds, and merchant reconciliation. New sales start paused.

## [1.6.0.0] - 2026-11-19

### Added
- Let authorized administrators edit order shipping details and notes before dispatch, with shipment and tax-destination safeguards and an order-history event.

### Fixed
- Prevent admin address edits from changing the shipping destination while retaining an outdated shipping quote and courier selection.
- Load the configured currency and branding on first admin login without requiring a page refresh.
- Keep corrected guest contact emails synchronized with guest-order claiming.
- Restore the order-edit client API helper and update stale dashboard and public-tag test expectations.

## [1.5.2.1] - 2026-11-16

### Changed
- Use a solid cream background on the admin sign-in page.

## [1.5.2.0] - 2026-11-16

### Added
- Let merchants mark Featured products and build ordered Staff Picks rows in Store Design.
- Rank Trending This Week by growth in recent product views and keep it separate from Most Viewed.
- Place product rows above or below supported storefront pages and preserve their configuration in theme templates.

## [1.5.1.0] - 2026-11-09

### Fixed
- Enforce first-order coupon eligibility across settled orders, including paid-then-cancelled orders, preventing coupon reuse after refunds.
- Re-evaluate auto coupons on storefront cart item swaps and capture guest email for digital-only orders to preserve per-customer limits.
- Attribute line-item discounts accurately during partial return refund computations to prevent over-refunding.
- Correct tax fallback calculations to detect active sale items properly.
- Deterministically sort auto coupons prior to transaction row locking to prevent deadlocks under concurrency.

## [1.5.0.0] - 2026-11-09

### Added
- Allow administrators to enable verified email codes as an alternate MFA method after an authenticator sign-in binds the current password.
- Rate-limit email MFA delivery and verification, with single-use five-minute codes, secure SMTP delivery, and session checks against the live policy.

## [1.4.2.0] - 2026-11-05

### Fixed
- Use the saved product type for inventory: Simple products use their own stock even when historical variant rows exist; Variable products retain per-SKU alerts.
- Preserve Simple stock and new reservations when fulfilling, releasing, or returning historical variant orders.
- Require confirmation and clear stale historical variant quantities before switching a Simple product back to Variable, including after its standalone stock reaches zero.
- Keep obsolete variant options out of Simple product purchases, and require confirmation before replacing Simple stock during a type change.
- Show SKU stock breakdowns for Variable products and retain the selected variant when opening an inventory alert.

## [1.4.1.0] - 2026-11-05

### Fixed
- Preserve unsaved variant stock and enabled-state edits in the inventory summary when saving product details.
- Show on-hand, reserved, and available inventory with separate active and disabled variant totals.
- Identify variant SKUs in inventory warnings and refresh alerts after products are disabled or restocked.
- Prevent unpublished products and legacy products with disabled variants from using standalone stock during cart and checkout operations.

## [1.4.0.0] - 2026-11-05

### Added
- Let super administrators require authenticator MFA for administrators, all staff, or selected staff roles from Security Settings; customers keep voluntary MFA.
- Let administrators manage their authenticator factor and backup codes from their profile while safely rotating their active session.

### Changed
- Apply saved MFA requirements immediately across password, phone, Google, refresh, and protected-session authentication.

## [1.3.0.0] - 2026-11-03

### Changed
- Require administrator MFA with operator-assisted enrollment and enforce MFA evidence across password, phone, Google, and refresh authentication.
- Coordinate refresh and account changes across browser tabs, and revoke rotated sessions safely during logout and permission changes.

### Fixed
- Commit refresh-token replay revocation and OTP attempt counters before returning authentication errors.
- Consume OTPs under row locks, validate OAuth state and redirects, enforce password byte limits, and reject unsafe cookie and cryptographic-secret configuration.
- Disable creation of demo accounts with default passwords.

### Documentation
- Add account/login security evidence, rollout requirements, an authentication ADR, and a security learning guide.

## [1.2.1.0] - 2026-11-03

### Fixed
- Allow payment providers to retry failed webhook settlements without losing the captured-payment event to duplicate detection.
- Share login limits, email throttles, and session revocations across server instances and restarts.
- Prevent removal of media files that are still referenced and validate public menu slugs before lookup.

### Changed
- Load API Builder relations in batches and fetch newsletter delivery totals in one grouped query.

## [1.2.0.0] - 2026-10-31

### Added
- Let admins set how many child links appear at first in a menu, then let storefront visitors load more items in batches through the public menu API.

## [1.1.2.3] - 2026-10-29

### Changed
- Clarify store mode behavior, lock mode-disabled feature visibility switches, and make platform feature settings easier to scan on desktop and mobile.

## [1.1.2.2] - 2026-10-26

### Added
- Require double opt-in for new newsletter subscriptions, preserve consent evidence, and add one-click unsubscribe support for campaign email.
- Recover interrupted notification and campaign jobs without exceeding retry limits or sending duplicate campaign messages.

### Fixed
- Report confirmation email queue failures accurately across storefront and account subscription flows.
- Prevent stale confirmation links and concurrent unsubscribe actions from activating or changing the wrong subscription.

## [1.1.2.1] - 2026-10-23

### Added
- Let administrators turn customer enquiry acknowledgement emails on or off while choosing staff recipients through the existing notification settings.
- Make the enquiry notification templates easier to find and edit in the admin settings.

## [1.1.2.0] - 2026-10-22

### Changed
- Combine product price and tax controls, clarify store and product-specific rates, and preview tax using the active sale price with the correct same-state or interstate GST rate.

## [1.1.1.0] - 2026-10-22

### Changed
- Move product SEO settings into a full-width horizontal section at the bottom of the editor, default shipping off for new products, and label the classification section “Categories & Brand”.

## [1.1.0.0] - 2026-09-26

### Added
- Give admins one Draft, Published, Paused, or Archived state selector across product management, including bulk updates and CSV exports.

### Changed
- Align product filters, summary counts, and the dashboard's published total with storefront availability.
