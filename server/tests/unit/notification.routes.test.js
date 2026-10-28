import { describe, expect, it, vi } from 'vitest';

const router = require('../../src/modules/notification/notification.routes');
const permissionGate = (path, method) => router.stack
  .find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle;
const check = (path, method, permissions) => {
  const next = vi.fn();
  permissionGate(path, method)({ user: { permissions } }, {}, next);
  return next;
};

describe('Notification endpoint permission integration', () => {
  it.each([
    ['/events', 'get'],
    ['/recipient-options', 'get'],
    ['/events/:event', 'get'],
    ['/events/:event/history', 'get'],
    ['/events/:event/preview', 'post'],
    ['/templates', 'get'],
    ['/templates/:name', 'get'],
    ['/templates/:name/default', 'get'],
    ['/templates/:name/preview', 'post'],
  ])('allows either read grant and denies unrelated staff for %s (%s)', (path, method) => {
    for (const permission of ['settings.read', 'notifications.manage']) {
      expect(check(path, method, [permission])).toHaveBeenCalledWith();
    }
    expect(check(path, method, ['products.read'])).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it.each([
    ['/recipients', 'get'],
    ['/recipients', 'put'],
    ['/events/:event', 'put'],
    ['/events/:event/test', 'post'],
    ['/templates/:name', 'put'],
    ['/templates/:name/reset', 'post'],
    ['/test', 'post'],
    ['/templates/test', 'post'],
  ])('requires notification management for %s (%s)', (path, method) => {
    expect(check(path, method, ['notifications.manage'])).toHaveBeenCalledWith();
    expect(check(path, method, ['settings.read'])).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 })
    );
  });
});
