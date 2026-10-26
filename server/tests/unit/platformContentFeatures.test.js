import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const modes = require('../../src/config/modes');
const featureMiddleware = require('../../src/middleware/featureGate.middleware');
const catalog = require('../../../shared/platform-features.json');
const galleries = require('../../src/modules/gallery/gallery.routes');
const blogs = require('../../src/modules/blog/blog.routes');
const newsletter = require('../../src/modules/newsletter/newsletter.routes');

const route = (router, path, method = 'get') => router.stack.find((l) => l.route?.path === path && l.route.methods[method]).route;
const state = (key, enabled) => {
  featureMiddleware.clearFeatureCache();
  vi.spyOn(db.Setting, 'findAll').mockResolvedValue([{ key, value: enabled }]);
  vi.spyOn(db.Setting, 'findOne').mockResolvedValue({ value: 'ecommerce' });
};
afterEach(() => { vi.restoreAllMocks(); featureMiddleware.clearFeatureCache(); });

describe('Content platform switches', () => {
  it.each(['ecommerce', 'catalog'])('provides every supported UI switch in %s defaults', (mode) => {
    const flags = modes.buildFeatures({}, mode);
    catalog.optional.forEach(({ key, defaults }) => {
      expect(modes.TIER2_DEFAULTS[mode][key]).toBe(defaults[mode]);
      expect(typeof flags[key]).toBe('boolean');
    });
    for (const key of ['gallery', 'newsletter', 'blogs']) {
      expect(flags[key]).toBe(true);
      expect(modes.isTier1Feature(key)).toBe(false);
      expect(modes.buildFeatures({ [key]: false }, mode)[key]).toBe(false);
    }
  });
  it.each([
    [galleries, '/public', 'gallery', 'get'], [galleries, '/public/:slug', 'gallery', 'get'],
    [blogs, '/posts', 'blogs', 'get'], [blogs, '/posts/:slug', 'blogs', 'get'],
    [blogs, '/categories', 'blogs', 'get'], [newsletter, '/subscribe', 'newsletter', 'post'],
  ])('keeps public content anonymous when enabled and denies it when disabled', async (router, path, key, method) => {
    const gate = route(router, path, method).stack[0].handle;
    expect(gate.featureKey).toBe(key);
    state(key, true);
    const enabled = vi.fn(); await gate({}, {}, enabled); expect(enabled).toHaveBeenCalledWith();
    state(key, false);
    const disabled = vi.fn(); await gate({}, {}, disabled);
    expect(disabled).toHaveBeenCalledWith(expect.objectContaining({ code: 'FEATURE_DISABLED', statusCode: 403 }));
  });
  it('retains unsubscribe and historical staff access when newsletter is off', () => {
    for (const [path, method] of [['/unsubscribe', 'post'], ['/unsubscribe/:token', 'get'], ['/campaigns/:id/cancel', 'post'], ['/', 'get']]) {
      expect(route(newsletter, path, method).stack.some((l) => l.handle.featureGate)).toBe(false);
    }
  });
  it.each([
    [galleries, '/', 'post', 'gallery'], [galleries, '/:id', 'patch', 'gallery'],
    [galleries, '/:id', 'delete', 'gallery'], [galleries, '/:id/items', 'post', 'gallery'],
    [galleries, '/:id/items/:itemId', 'delete', 'gallery'], [galleries, '/:id/reorder', 'patch', 'gallery'],
    [blogs, '/admin/posts', 'post', 'blogs'], [blogs, '/admin/posts/:id', 'put', 'blogs'],
    [blogs, '/admin/posts/:id', 'delete', 'blogs'], [blogs, '/categories', 'post', 'blogs'],
    [blogs, '/categories/:id', 'put', 'blogs'], [blogs, '/categories/:id', 'delete', 'blogs'],
  ])('blocks authorized module writes when the %s feature is off', (router, path, method, key) => {
    const gates = route(router, path, method).stack.filter((layer) => layer.handle.featureGate);
    expect(gates.some((layer) => layer.handle.featureKey === key)).toBe(true);
  });
  it('rejects direct account resubscription and pauses the campaign scheduler when disabled', async () => {
    vi.spyOn(featureMiddleware, 'getResolvedFeature').mockResolvedValue(false);
    const find = vi.spyOn(db.NewsletterSubscriber, 'findOne');
    const due = vi.spyOn(db.NewsletterCampaign, 'findAll');
    await expect(require('../../src/modules/newsletter/newsletter.service').subscribe('customer@example.test')).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
    await require('../../src/modules/newsletter/newsletterCampaign.service').queueDue();
    expect(find).not.toHaveBeenCalled(); expect(due).not.toHaveBeenCalled();
  });
  it('pauses queued newsletter mail while continuing the transactional mail queue', async () => {
    vi.spyOn(featureMiddleware, 'getResolvedFeature').mockResolvedValue(false);
    const find = vi.spyOn(db.NotificationQueue, 'findAll').mockResolvedValue([]);
    await require('../../src/modules/notification/notification.service').processQueued();
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      templateName: { [db.Sequelize.Op.notIn]: ['newsletter_campaign', 'newsletter_confirmation'] },
    }) }));
  });
  it('blocks direct test sends for newsletter templates while the feature is off', async () => {
    vi.spyOn(featureMiddleware, 'getResolvedFeature').mockResolvedValue(false);
    const findTemplate = vi.spyOn(db.NotificationTemplate, 'findOne');
    await expect(require('../../src/modules/notification/notification.service').sendImmediate(
      'newsletter_campaign', 'recipient@example.test', {}, null, null, 'email'
    )).rejects.toMatchObject({ code: 'FEATURE_DISABLED', statusCode: 403 });
    expect(findTemplate).not.toHaveBeenCalled();
  });
});
