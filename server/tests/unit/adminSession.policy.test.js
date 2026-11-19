'use strict';

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { enforceAdminSession } = require('../../src/middleware/auth.middleware');

describe('admin session lifetime policy', () => {
  const session = (overrides = {}) => ({
    createdAt: new Date('2026-11-13T00:00:00.000Z'),
    absoluteExpiresAt: new Date('2026-11-13T12:00:00.000Z'),
    lastActiveAt: new Date('2026-11-13T11:30:00.000Z'),
    ...overrides,
  });

  it('rejects at the 12-hour absolute deadline regardless of activity', () => {
    const now = Date.now;
    Date.now = () => Date.parse('2026-11-13T12:00:00.000Z');
    try {
      expect(() => enforceAdminSession({ roles: ['admin'] }, {}, session({ lastActiveAt: new Date() })))
        .toThrow(expect.objectContaining({ code: 'ADMIN_SESSION_EXPIRED', statusCode: 401 }));
    } finally { Date.now = now; }
  });

  it('rejects at 30 minutes idle but accepts activity immediately before it', () => {
    const now = Date.now;
    Date.now = () => Date.parse('2026-11-13T11:59:59.000Z');
    try {
      expect(() => enforceAdminSession({ roles: ['super_admin'] }, {}, session({ lastActiveAt: new Date('2026-11-13T11:29:59.000Z') })))
        .toThrow(expect.objectContaining({ code: 'ADMIN_SESSION_EXPIRED' }));
      expect(() => enforceAdminSession({ permissions: ['dashboard.view'] }, {}, session({ lastActiveAt: new Date('2026-11-13T11:30:01.000Z') })))
        .not.toThrow();
    } finally { Date.now = now; }
  });

  it('does not impose the staff idle policy on customers', () => {
    expect(() => enforceAdminSession({ roles: ['customer'] }, {}, session({ lastActiveAt: new Date(0), absoluteExpiresAt: new Date(0) })))
      .not.toThrow();
  });

  it('rejects administrative tokens that have no durable session', () => {
    expect(() => enforceAdminSession({ roles: ['admin'] }, {}, null))
      .toThrow(expect.objectContaining({ code: 'ADMIN_SESSION_EXPIRED', statusCode: 401 }));
  });
});

describe('admin session status contract', () => {
  it('reports server deadlines and a same-user context without granting access', () => {
    const policy = require('../../src/modules/auth/adminSession');
    const jwt = require('jsonwebtoken');
    process.env.JWT_ACCESS_SECRET = 'admin-session-test-secret-long-enough-for-hs256';
    const now = Date.now();
    const result = policy.status({ id: 'admin-1', role: 'admin' }, {
      id: 'session-1', createdAt: new Date(now - 3600000), lastActiveAt: new Date(now), expiresAt: new Date(now + 86400000), absoluteExpiresAt: new Date(now + 86400000),
    });
    expect(result.userId).toBe('admin-1');
    expect(+result.absoluteExpiresAt).toBe(now + 11 * 3600000);
    expect(+result.idleExpiresAt).toBe(now + 1800000);
    const context = jwt.verify(result.reauthContext, process.env.JWT_ACCESS_SECRET);
    expect(context.purpose).toBe('admin_reauth');
    expect(context.id).toBe('admin-1');
    expect(context.exp - context.iat).toBe(30 * 86400);
  });
});
