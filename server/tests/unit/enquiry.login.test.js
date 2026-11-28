import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const { Enquiry, Product, ProductVariant, RefreshToken, Setting, User } = require('../../src/modules');
const { buildFeatures } = require('../../src/config/modes');
const { clearFeatureCache } = require('../../src/middleware/featureGate.middleware');
const { errorHandler } = require('../../src/middleware/errorHandler.middleware');
const router = require('../../src/modules/enquiry/enquiry.routes');
const settings = require('../../src/modules/settings/settings.service');
const notifications = require('../../src/modules/notification/notification.service');

const productId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const claimedUserId = '33333333-3333-4333-8333-333333333333';
const replyEmail = 'purchasing@example.com';
const jwtSecret = 'enquiry-test-secret-used-only-in-this-file';
const csrfToken = 'a'.repeat(64);

const token = (expiresIn = 60) => jwt.sign({ id: userId, sid: 'test-session' }, jwtSecret, {
  expiresIn,
  issuer: process.env.JWT_ISSUER || 'ecommerce-pro',
  audience: process.env.JWT_AUDIENCE || 'ecommerce-pro-client',
});

const submitEnquiry = (accessToken, { csrfHeader, authorization, origin } = {}) => new Promise((resolve) => {
  const headers = { origin, authorization, 'x-csrf-token': csrfHeader };
  const req = {
    method: 'POST', url: '/', headers,
    get: (name) => headers[name.toLowerCase()],
    cookies: { auth_access_token: accessToken, csrf_token: csrfToken },
    body: { name: 'Test Customer', email: replyEmail, message: 'Please send details.', productId, submittedByUserId: claimedUserId },
  };
  const res = {
    status(status) { this.statusCode = status; return this; },
    json(body) { resolve({ status: this.statusCode, body }); },
  };
  router.handle(req, res, (error) => errorHandler(error, req, res));
});

describe('Enquiry login policy', () => {
  beforeEach(() => {
    clearFeatureCache();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('JWT_ACCESS_SECRET', jwtSecret);
    vi.spyOn(Setting, 'findAll').mockResolvedValue([]);
    vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: 'catalog' });
    vi.spyOn(RefreshToken, 'findByPk').mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000) });
    vi.spyOn(User, 'findByPk').mockResolvedValue({ id: userId, email: 'account@example.com', role: 'customer', status: 'active' });
    vi.spyOn(Product, 'findByPk').mockResolvedValue({ id: productId, name: 'Product', type: 'simple', status: 'published' });
    vi.spyOn(ProductVariant, 'count').mockResolvedValue(0);
    vi.spyOn(Enquiry, 'create').mockImplementation(async (payload) => ({ id: 'saved-enquiry', ...payload }));
    vi.spyOn(settings, 'getAll').mockResolvedValue({});
    vi.spyOn(notifications, 'sendEvent').mockResolvedValue([]);
  });

  afterEach(() => {
    clearFeatureCache();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(['ecommerce', 'catalog'])('defaults to guest access in %s mode', (mode) => {
    expect(buildFeatures({}, mode).requireLoginForEnquiry).toBe(false);
  });

  it('keeps guest submissions working and ignores account IDs in the request body', async () => {
    expect(await submitEnquiry(token(), { origin: 'https://static.example' })).toMatchObject({ status: 201 });
    expect(Enquiry.create).toHaveBeenCalledWith(expect.objectContaining({ email: replyEmail, submittedByUserId: null }));
  });

  it('requires a verified session before saving and keeps the editable reply email', async () => {
    Setting.findAll.mockResolvedValue([{ key: 'requireLoginForEnquiry', value: true }]);
    RefreshToken.findByPk.mockResolvedValueOnce({ revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });

    for (const accessToken of [undefined, token(-60), token()]) {
      expect(await submitEnquiry(accessToken)).toMatchObject({ status: 401, body: { error: { code: 'UNAUTHORIZED' } } });
    }
    expect(Enquiry.create).not.toHaveBeenCalled();

    expect(await submitEnquiry(token(), { csrfHeader: csrfToken })).toMatchObject({ status: 201 });
    expect(Enquiry.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ email: replyEmail, submittedByUserId: userId }));
  });

  it('protects cookie-authenticated submissions while keeping non-browser bearer clients working', async () => {
    Setting.findAll.mockResolvedValue([{ key: 'requireLoginForEnquiry', value: true }]);
    expect(await submitEnquiry(token())).toMatchObject({ status: 403, body: { error: { code: 'CSRF_TOKEN_INVALID' } } });
    expect(await submitEnquiry(token(), { csrfHeader: 'b'.repeat(64) })).toMatchObject({ status: 403, body: { error: { code: 'CSRF_TOKEN_INVALID' } } });
    expect(Enquiry.create).not.toHaveBeenCalled();

    expect(await submitEnquiry(undefined, { authorization: `Bearer ${token()}` })).toMatchObject({ status: 201 });
  });

  it('returns the disabled-feature response before applying login requirements', async () => {
    Setting.findAll.mockResolvedValue([{ key: 'enquiry', value: false }, { key: 'requireLoginForEnquiry', value: true }]);
    expect(await submitEnquiry()).toMatchObject({ status: 403, body: { error: { code: 'FEATURE_DISABLED' } } });
    expect(Enquiry.create).not.toHaveBeenCalled();
  });
});
