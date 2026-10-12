import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { Setting } = require('../../src/modules');
const SettingsService = require('../../src/modules/settings/settings.service');

afterEach(() => vi.restoreAllMocks());

describe('Customer cancellation policy settings', () => {
    it('exposes the default policy through the public orders settings group', async () => {
        vi.spyOn(Setting, 'findAll').mockResolvedValue([]);

        const policy = await SettingsService.getByGroup('orders');

        expect(policy.cancellationPolicy).toContain('before a shipment is created');
        expect(policy.cancellationPolicy).toContain('does not issue an automatic refund');
    });

    it('rejects policy text over the supported limit before saving', async () => {
        await expect(SettingsService.bulkUpdate([
            { group: 'orders', key: 'cancellationPolicy', value: 'x'.repeat(2001) },
        ], 'admin'))
            .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
});
