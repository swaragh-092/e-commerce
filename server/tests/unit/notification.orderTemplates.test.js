import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { compileTemplate } = require('../../src/modules/notification/notification.service');
const { DEFAULTS } = require('../../src/modules/notification/notification.defaults');
const settings = require('../../src/modules/settings/settings.service');

beforeEach(() => {
    vi.stubEnv('CLIENT_URL', 'https://shop.example.test, https://other.example.test');
    vi.stubEnv('NOTIFICATION_ADMIN_URL', 'https://staff.example.test/');
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({});
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe('order notification rendering', () => {
    it.each(['order_placed', 'order_shipped', 'order_delivered', 'order_out_for_delivery'])('renders %s links only for account orders', async (name) => {
        const vars = { order_id: 'order-123', customer_name: 'Alex & Sam' };
        const account = await compileTemplate(DEFAULTS[name], vars);
        expect(account.html).toContain('https://shop.example.test/account/orders/order-123');
        expect(account.text).toContain('https://shop.example.test/account/orders/order-123');
        const guest = await compileTemplate(DEFAULTS[name], { ...vars, guest_order: true });
        expect(guest.html).not.toContain('/account/orders/');
        expect(guest.text).not.toContain('/account/orders/');
        expect(guest.html).not.toContain('mailto:');
        expect(guest.html).not.toContain('you have an account');
    });

    it('uses the admin host and keeps payment URLs usable in plain text', async () => {
        const vars = { order_id: 'order-123' };
        const admin = await compileTemplate(DEFAULTS.admin_order_failed, vars);
        expect(admin.html).toContain('https://staff.example.test/admin/orders/order-123');
        expect(admin.text).toContain('https://staff.example.test/admin/orders/order-123');
        const customer = await compileTemplate(DEFAULTS.payment_failed_customer, vars);
        expect(customer.text).toContain('https://shop.example.test/payment/failure?orderId=order-123');
    });

    it('renders confirmed partial refunds without promising a settlement date', async () => {
        const refund = await compileTemplate(DEFAULTS.order_refunded, {
            order_id: 'order-123', refund_amount: '12.50', refund_amount_display: '€12.50',
            refund_reference: 'refund-123', refund_is_partial: true,
        });
        for (const content of [refund.html, refund.text]) {
            expect(content).toContain('Partial refund');
            expect(content).toContain('€12.50');
            expect(content).toContain('refund-123');
            expect(content).not.toContain('business days');
        }
    });
});

describe('account link expiry copy', () => {
    it.each([
        ['password_reset', '15 minutes'],
        ['email_verification', '24 hours'],
        ['email_change_verification', '24 hours'],
    ])('renders the actual %s expiry window', async (name, duration) => {
        const { html, text } = await compileTemplate(DEFAULTS[name]);
        for (const content of [html, text]) {
            expect(content).toContain(`valid for ${duration} from the time it was requested`);
        }
    });
});
