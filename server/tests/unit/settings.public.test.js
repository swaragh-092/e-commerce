import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const settingsService = require('../../src/modules/settings/settings.service');
const settingsRouter = require('../../src/modules/settings/settings.routes');
const {
  PUBLIC_SETTING_GROUPS,
  pickPublicSettings,
  pickPublicGroup,
} = require('../../src/config/publicSettings');

afterEach(() => vi.restoreAllMocks());

describe('Public settings allowlist', () => {
  it('keeps privileged and credential groups out of the storefront payload', () => {
    const result = pickPublicSettings({
      general: { storeName: 'Shop' },
      theme: { primaryColor: '#000' },
      admin: { dashboard: { secret: true } },
      messaging: { smtp: { password: 'secret' } },
      gateway_credentials: { stripe: { secretKey: 'secret' } },
      messaging_credentials: { smtp: { password: 'secret' } },
      ai: { internal: true },
      ai_credentials: { openai: 'secret' },
      advanced: {
        customCSS: 'body{}',
        headScripts: '<script></script>',
        bodyScripts: '<script></script>',
        internalFlag: true,
      },
    });

    expect(result.general).toEqual({ storeName: 'Shop' });
    expect(result.theme).toEqual({ primaryColor: '#000' });
    expect(result.admin).toBeUndefined();
    expect(result.messaging).toBeUndefined();
    expect(result.gateway_credentials).toBeUndefined();
    expect(result.messaging_credentials).toBeUndefined();
    expect(result.ai).toBeUndefined();
    expect(result.ai_credentials).toBeUndefined();
    expect(result.advanced).toEqual({
      customCSS: 'body{}',
      headScripts: '<script></script>',
      bodyScripts: '<script></script>',
    });
    expect(PUBLIC_SETTING_GROUPS).toContain('catalog');
    expect(PUBLIC_SETTING_GROUPS).not.toContain('admin');
  });

  it('rejects public access to private groups', async () => {
    for (const group of ['admin', 'messaging', 'gateway_credentials', 'messaging_credentials', 'ai', 'ai_credentials']) {
      await expect(settingsService.getPublicGroup(group)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid public setting group',
      });
    }
  });

  it('filters advanced settings to only storefront-safe keys', () => {
    expect(pickPublicGroup('advanced', {
      customCSS: 'body{}',
      headScripts: '<script></script>',
      bodyScripts: '<script></script>',
      internalFlag: true,
    })).toEqual({
      customCSS: 'body{}',
      headScripts: '<script></script>',
      bodyScripts: '<script></script>',
    });
  });

  it('masks nested PayU key and salt while preserving public identifiers', async () => {
    vi.spyOn(db.Setting, 'findAll').mockResolvedValue([
      {
        group: 'payments',
        key: 'payu',
        value: {
          enabled: true,
          merchantKey: 'public-merchant-key',
          key: 'secret-key',
          salt: 'secret-salt',
          publishableKey: 'public-publishable',
        },
      },
    ]);

    const payments = await settingsService.getByGroup('payments', { maskSensitive: false });
    expect(payments.payu).toEqual({
      enabled: true,
      merchantKey: 'public-merchant-key',
      key: 'secret-key',
      salt: 'secret-salt',
      publishableKey: 'public-publishable',
    });

    const masked = await settingsService.getByGroup('payments');
    expect(masked.payu.key).toBe('********');
    expect(masked.payu.salt).toBe('********');
    expect(masked.payu.merchantKey).toBe('public-merchant-key');
    expect(masked.payu.publishableKey).toBe('public-publishable');
  });
});


describe('Public settings routes', () => {
  it('exposes storefront settings without auth while protecting full settings reads', () => {
    const routes = settingsRouter.stack
      .filter((layer) => layer.route)
      .map((layer, index) => ({
        path: layer.route.path,
        index,
        middlewareCount: layer.route.stack.length,
      }));

    const publicAll = routes.find((route) => route.path === '/public');
    const publicGroup = routes.find((route) => route.path === '/public/:group');
    const all = routes.find((route) => route.path === '/');
    const group = routes.find((route) => route.path === '/:group');

    expect(publicAll?.middlewareCount).toBe(1);
    expect(publicGroup?.middlewareCount).toBe(1);
    expect(all?.middlewareCount).toBe(3);
    expect(group?.middlewareCount).toBe(3);
    expect(publicAll.index).toBeLessThan(group.index);
    expect(publicGroup.index).toBeLessThan(group.index);
  });
});
