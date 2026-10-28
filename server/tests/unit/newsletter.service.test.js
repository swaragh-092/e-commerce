import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const featureMiddleware = require('../../src/middleware/featureGate.middleware');
const NotificationService = require('../../src/modules/notification/notification.service');
const service = require('../../src/modules/newsletter/newsletter.service');
const campaigns = require('../../src/modules/newsletter/newsletterCampaign.service');
const routes = require('../../src/modules/newsletter/newsletter.routes');
const AppError = require('../../src/utils/AppError');

const route = (path, method) => routes.stack.find((l) => l.route?.path === path && l.route.methods[method])?.route;

const subscriberRow = (overrides = {}) => ({
  id: 'sub-1',
  email: 'user@example.com',
  status: 'active',
  source: 'homepage',
  subscribedAt: new Date('2026-01-01T00:00:00.000Z'),
  unsubscribedAt: null,
  unsubscribeToken: 'tok_123',
  update: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(featureMiddleware, 'getResolvedFeature').mockResolvedValue(true);
  vi.spyOn(NotificationService, 'send').mockResolvedValue(true);
});

afterEach(() => vi.restoreAllMocks());

describe('newsletter.service.subscribe (double opt-in)', () => {
  it('rejects invalid emails and non-slug sources', async () => {
    const findOne = vi.spyOn(db.NewsletterSubscriber, 'findOne');
    await expect(service.subscribe('not-an-email')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.subscribe('a@b.com', 'Evil Source!')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.subscribe('a@b.com', '=HYPERLINK("x")')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('creates new subscribers as pending and never returns tokens', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(null);
    const row = subscriberRow({ status: 'pending' });
    vi.spyOn(db.NewsletterSubscriber, 'create').mockResolvedValue(row);

    const result = await service.subscribe('User@Example.com', 'register', { ip: '203.0.113.9', userAgent: 'ua/1' });

    expect(result).toEqual({ pending: true, confirmationQueued: true });
    expect(result.unsubscribeToken).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('tok_123');
    expect(db.NewsletterSubscriber.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'user@example.com',
      status: 'pending',
      source: 'register',
      consentIp: '203.0.113.9',
      consentUserAgent: 'ua/1',
    }));
    // Successful queueing persists the confirm-queued marker for reload checks.
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ lastConfirmQueuedAt: expect.any(Date) }));
    expect(NotificationService.send).toHaveBeenCalledWith(
      'newsletter_confirm', 'user@example.com',
      expect.objectContaining({ confirm_url: expect.stringContaining('tok_123') }),
      null, null, 'email', null,
      expect.stringContaining('newsletter_confirm:sub-1:'),
    );
  });

  it('reports alreadySubscribed without leaking the token for active rows', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(subscriberRow({ status: 'active' }));
    const result = await service.subscribe('user@example.com');
    expect(result).toEqual({ alreadySubscribed: true });
    expect(JSON.stringify(result)).not.toContain('tok_123');
  });

  it('restarts verification for unsubscribed rows, rotating the token so stale links die', async () => {
    const row = subscriberRow({ status: 'unsubscribed', unsubscribedAt: new Date() });
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(row);
    const result = await service.subscribe('user@example.com', 'homepage', { ip: '198.51.100.2' });
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      unsubscribedAt: null,
      consentIp: '198.51.100.2',
    }));
    const updateArgs = row.update.mock.calls[0][0];
    expect(updateArgs.unsubscribeToken).toBeTruthy();
    expect(updateArgs.unsubscribeToken).not.toBe('tok_123');
    expect(result).toEqual({ pending: true, confirmationQueued: true });
  });

  it('rotates the token for pending restarts too, invalidating previous confirm links', async () => {
    const row = subscriberRow({ status: 'pending' });
    // Apply updates to the row like the real model does, so the follow-up
    // queueConfirmEmail sees the rotated token.
    row.update = vi.fn().mockImplementation(async (values) => { Object.assign(row, values); return row; });
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(row);
    await service.subscribe('user@example.com');
    const updateArgs = row.update.mock.calls[0][0];
    expect(updateArgs.unsubscribeToken).not.toBe('tok_123');
    // The new confirm email must embed the rotated token, not the old one.
    expect(NotificationService.send).toHaveBeenCalledWith(
      'newsletter_confirm', 'user@example.com',
      expect.objectContaining({ confirm_url: expect.not.stringContaining('tok_123') }),
      null, null, 'email', null,
      expect.any(String),
    );
  });

  it('surfaces confirmation queue failures without failing the subscription', async () => {
    NotificationService.send.mockResolvedValue(false);
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(null);
    const row = subscriberRow({ status: 'pending' });
    vi.spyOn(db.NewsletterSubscriber, 'create').mockResolvedValue(row);
    const result = await service.subscribe('user@example.com');
    expect(result).toEqual({ pending: true, confirmationQueued: false });
    // No confirm-queued marker is written when queueing failed.
    expect(row.update).not.toHaveBeenCalledWith(expect.objectContaining({ lastConfirmQueuedAt: expect.any(Date) }));
  });

  it('maps a concurrent-create unique violation to 409', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.NewsletterSubscriber, 'create').mockRejectedValue({ name: 'SequelizeUniqueConstraintError' });
    await expect(service.subscribe('user@example.com')).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });

  it('fails closed while the feature is disabled', async () => {
    featureMiddleware.getResolvedFeature.mockResolvedValue(false);
    await expect(service.subscribe('user@example.com')).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
  });
});

describe('newsletter.service.confirm', () => {
  it('activates a pending subscriber atomically and queues the welcome email', async () => {
    const row = subscriberRow({ status: 'active' });
    const update = vi.spyOn(db.NewsletterSubscriber, 'update').mockResolvedValue([1]);
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(row);
    const result = await service.confirm('tok_123');
    // The transition is a conditional UPDATE — never a read-then-write.
    expect(update).toHaveBeenCalledWith(
      { status: 'active' },
      { where: { unsubscribeToken: 'tok_123', status: 'pending' } },
    );
    expect(result).toEqual({ confirmed: true, welcomeQueued: true });
    expect(NotificationService.send).toHaveBeenCalledWith(
      'newsletter_confirmation', 'user@example.com',
      expect.objectContaining({ unsubscribe_url: expect.stringContaining('tok_123') }),
    );
  });

  it('never undoes a concurrent unsubscribe (conditional update matches zero rows)', async () => {
    // Simulate: unsubscribe won the race, so the pending→active UPDATE
    // affected 0 rows and the row now reads as unsubscribed.
    const update = vi.spyOn(db.NewsletterSubscriber, 'update').mockResolvedValue([0]);
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(subscriberRow({ status: 'unsubscribed' }));
    const result = await service.confirm('tok_123');
    expect(update).toHaveBeenCalledWith(
      { status: 'active' },
      { where: { unsubscribeToken: 'tok_123', status: 'pending' } },
    );
    expect(result).toEqual({ cancelled: true });
    expect(NotificationService.send).not.toHaveBeenCalledWith('newsletter_confirmation', expect.anything(), expect.anything());
  });

  it('is idempotent for already-active subscribers', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'update').mockResolvedValue([0]);
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(subscriberRow({ status: 'active' }));
    const result = await service.confirm('tok_123');
    expect(result).toEqual({ alreadyConfirmed: true });
  });

  it('never reactivates an unsubscribed row from a stale confirm link', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'update').mockResolvedValue([0]);
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(subscriberRow({ status: 'unsubscribed' }));
    const result = await service.confirm('tok_123');
    expect(result).toEqual({ cancelled: true });
  });

  it('rejects unknown tokens and missing tokens', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'update').mockResolvedValue([0]);
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(null);
    await expect(service.confirm('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.confirm('')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('newsletter.service.unsubscribe', () => {
  it('returns identical responses for unknown and already-unsubscribed emails', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(null);
    const unknown = await service.unsubscribe('ghost@example.com');
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(subscriberRow({ status: 'unsubscribed' }));
    const known = await service.unsubscribe('user@example.com');
    expect(unknown).toEqual(known);
    expect(unknown).toEqual({ unsubscribed: true });
  });

  it('unsubscribes by token and is idempotent', async () => {
    const row = subscriberRow();
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(row);
    const update = vi.spyOn(db.NewsletterSubscriber, 'update').mockResolvedValue([1]);
    expect(await service.unsubscribeByToken('tok_123')).toEqual({ unsubscribed: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'unsubscribed' }),
      { where: { id: row.id, unsubscribeToken: 'tok_123' } },
    );
    row.status = 'unsubscribed';
    expect(await service.unsubscribeByToken('tok_123')).toEqual({ alreadyUnsubscribed: true });
  });
});

describe('newsletter.service.list', () => {
  it('clamps the page size and never exposes tokens or consent metadata', async () => {
    const findAndCountAll = vi.spyOn(db.NewsletterSubscriber, 'findAndCountAll').mockResolvedValue({ count: 0, rows: [] });
    await service.list({ limit: '1000000', offset: '-5' });
    expect(findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      limit: 500,
      offset: 0,
      attributes: { exclude: ['unsubscribeToken', 'consentIp', 'consentUserAgent', 'lastConfirmQueuedAt'] },
    }));
    await service.list({ limit: 'bogus' });
    expect(findAndCountAll).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50, offset: 0 }));
  });
});

describe('newsletter.service.getStatus (confirm-queued marker)', () => {
  const statusRow = (overrides = {}) => subscriberRow(overrides);

  it('reports confirmationQueued=true only when the marker belongs to the current pending session', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(statusRow({
      status: 'pending',
      subscribedAt: new Date('2026-01-01T00:00:00.000Z'),
      lastConfirmQueuedAt: new Date('2026-01-01T00:00:05.000Z'),
    }));
    expect(await service.getStatus('user@example.com')).toEqual({ subscribed: false, pending: true, confirmationQueued: true });
  });

  it('reports confirmationQueued=false for a pending row with no marker (failed send)', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(statusRow({
      status: 'pending',
      subscribedAt: new Date('2026-01-01T00:00:00.000Z'),
      lastConfirmQueuedAt: null,
    }));
    expect(await service.getStatus('user@example.com')).toEqual({ subscribed: false, pending: true, confirmationQueued: false });
  });

  it('treats a marker older than subscribedAt as stale (previous consent session)', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(statusRow({
      status: 'pending',
      subscribedAt: new Date('2026-01-02T00:00:00.000Z'),
      lastConfirmQueuedAt: new Date('2026-01-01T00:00:00.000Z'),
    }));
    expect(await service.getStatus('user@example.com')).toEqual({ subscribed: false, pending: true, confirmationQueued: false });
  });

  it('does not claim confirmationQueued for active subscribers', async () => {
    vi.spyOn(db.NewsletterSubscriber, 'findOne').mockResolvedValue(statusRow({
      status: 'active',
      lastConfirmQueuedAt: new Date(),
    }));
    expect(await service.getStatus('user@example.com')).toEqual({ subscribed: true, pending: false, confirmationQueued: false });
  });
});

describe('newsletterCampaign.service validation & urls', () => {
  it('rejects subjects with header-injection attempts and oversized content', () => {
    expect(() => campaigns.create({ subject: 'a\r\nBcc: evil@x.com', message: 'hi' }, 'u1')).toThrow(AppError);
    expect(() => campaigns.create({ subject: '', message: 'hi' }, 'u1')).toThrow(AppError);
    expect(() => campaigns.create({ subject: 'ok', message: 'x'.repeat(20001) }, 'u1')).toThrow(AppError);
  });

  it('builds confirm/unsubscribe/one-click URLs with encoded tokens', () => {
    expect(campaigns.confirmUrl('a b')).toContain('/newsletter/confirm?token=a%20b');
    expect(campaigns.unsubscribeUrl('a b')).toContain('/newsletter/unsubscribe?token=a%20b');
    expect(campaigns.oneClickUnsubscribeUrl('a b')).toContain('/api/newsletter/unsubscribe/one-click?token=a%20b');
  });

  it('does not duplicate /api when API_PUBLIC_URL already includes the API prefix', () => {
    vi.stubEnv('API_PUBLIC_URL', 'https://api.example.test/api');
    expect(campaigns.oneClickUnsubscribeUrl('token')).toBe('https://api.example.test/api/newsletter/unsubscribe/one-click?token=token');
    vi.unstubAllEnvs();
  });
});

describe('newsletter routes surface', () => {
  it('exposes only POST unsubscribe endpoints (no state-changing GET)', () => {
    expect(route('/unsubscribe', 'post')).toBeTruthy();
    expect(route('/unsubscribe/one-click', 'post')).toBeTruthy();
    expect(route('/confirm', 'post')).toBeTruthy();
    expect(route('/unsubscribe/:token', 'get')).toBeUndefined();
  });

  it('keeps unsubscribe and confirm available while the feature is off', () => {
    for (const [path, method] of [['/unsubscribe', 'post'], ['/unsubscribe/one-click', 'post'], ['/confirm', 'post']]) {
      expect(route(path, method).stack.some((l) => l.handle.featureGate)).toBe(false);
    }
  });
});
