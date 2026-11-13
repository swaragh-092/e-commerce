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
    Date.now = () => Date.parse('2026-11-13T12:00:00.000Z');
    try {
      expect(() => enforceAdminSession({ roles: ['super_admin'] }, {}, session()))
        .toThrow(expect.objectContaining({ code: 'ADMIN_SESSION_EXPIRED' }));
      expect(() => enforceAdminSession({ permissions: ['catalog:read'] }, {}, session({ lastActiveAt: new Date('2026-11-13T11:30:01.000Z') })))
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
