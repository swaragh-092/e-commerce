import { describe, it, expect } from 'vitest';

const NotificationService = require('../../src/modules/notification/notification.service');

describe('Order confirmation notification variables', () => {
    it('normalizes the order date and payment method variables used by the template', () => {
        const orderDate = new Date('2026-10-09T10:30:00.000Z');

        expect(NotificationService.normalizeVariables({
            orderDate,
            paymentMethod: 'Cash on Delivery',
        })).toMatchObject({
            order_date: orderDate,
            payment_method: 'Cash on Delivery',
        });
    });
});
