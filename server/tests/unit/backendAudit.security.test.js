import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const db = require('../../src/modules');
const { authenticate, optionalAuth } = require('../../src/middleware/auth.middleware');
const authController = require('../../src/modules/auth/auth.controller');
const media = require('../../src/modules/media/media.service');
const tokenBlocklist = require('../../src/utils/tokenBlocklist');
afterEach(() => vi.restoreAllMocks());
const request = () => ({ headers: { authorization: 'Bearer test-token' }, cookies: {}, body: {} });
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), clearCookie: vi.fn() });

describe('Backend audit security boundaries', () => {
  it.each([null, { revokedAt: new Date() }])('rejects a missing or revoked durable session', async (session) => {
    vi.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-1', sid: 'sid-durable' });
    vi.spyOn(db.RefreshToken, 'findByPk').mockResolvedValue(session);
    const user = vi.spyOn(db.User, 'findByPk'); const next = vi.fn();
    await authenticate(request(), response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(user).not.toHaveBeenCalled();
  });
  it('treats a revoked optional session as anonymous', async () => {
    vi.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-1', sid: 'sid-durable' });
    vi.spyOn(db.RefreshToken, 'findByPk').mockResolvedValue({ revokedAt: new Date() });
    const req = request(); const next = vi.fn();
    await optionalAuth(req, response(), next);
    expect(req.user).toBeUndefined(); expect(next).toHaveBeenCalledWith();
  });
  it('surfaces a failed durable logout instead of reporting success', async () => {
    vi.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-1', sid: 'sid-logout' });
    const failure = new Error('Database unavailable');
    vi.spyOn(db.RefreshToken, 'update').mockRejectedValue(failure);
    const res = response(); const next = vi.fn();
    await authController.logout(request(), res, next);
    expect(next).toHaveBeenCalledWith(failure); expect(res.json).not.toHaveBeenCalled();
  });
  it('persists access-only logout before acknowledging it', async () => {
    vi.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-1', sid: 'sid-logout' });
    const persist = vi.spyOn(db.RefreshToken, 'update').mockResolvedValue([1]);
    vi.spyOn(tokenBlocklist, 'revokeSession').mockImplementation(() => {});
    const res = response(); const next = vi.fn();
    await authController.logout(request(), res, next);
    expect(persist).toHaveBeenCalledWith({ revokedAt: expect.any(Date) }, { where: { id: 'sid-logout', revokedAt: null } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(next).not.toHaveBeenCalled();
  });
  it('refuses deletion before touching a referenced media record', async () => {
    const record = { get: vi.fn().mockReturnValue('2'), destroy: vi.fn() };
    vi.spyOn(db.Media, 'findByPk').mockResolvedValue(record);
    await expect(media.deleteMedia('media-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(record.destroy).not.toHaveBeenCalled();
  });
});
