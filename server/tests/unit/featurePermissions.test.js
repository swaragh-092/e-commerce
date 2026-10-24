import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const gallery = require('../../src/modules/gallery/gallery.routes');
const newsletter = require('../../src/modules/newsletter/newsletter.routes');
const blogs = require('../../src/modules/blog/blog.routes');
const notifications = require('../../src/modules/notification/notification.routes');

const gate = (router, method, path, permissions) => {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  // Notification authentication is router-wide; other routers authenticate per route.
  const middleware = route.stack[router === notifications ? 0 : 1].handle;
  let result;
  middleware({ user: { role: 'admin', permissions } }, {}, (error) => { result = error || 'allowed'; });
  return result;
};

describe('Independent feature authorization on direct API requests', () => {
  const cases = [
    [gallery, 'get', '/', 'gallery.read', ['media.read']],
    [gallery, 'post', '/', 'gallery.manage', ['media.update', 'gallery.read']],
    [gallery, 'patch', '/:id', 'gallery.manage', ['media.update', 'gallery.read']],
    [gallery, 'post', '/:id/items', ['gallery.manage', 'media.read'], ['media.update', 'gallery.read']],
    [gallery, 'patch', '/:id/reorder', 'gallery.manage', ['media.update', 'gallery.read']],
    [gallery, 'delete', '/:id', 'gallery.delete', ['gallery.manage', 'media.delete']],
    [gallery, 'delete', '/:id/items/:itemId', 'gallery.delete', ['gallery.manage', 'media.delete']],
    [newsletter, 'get', '/', 'newsletter.subscribers_read', ['settings.read', 'newsletter.read', 'newsletter.manage']],
    [newsletter, 'get', '/campaigns', 'newsletter.read', ['settings.read', 'notifications.manage']],
    ...[['post', '/campaigns'], ['post', '/campaigns/test'], ['put', '/campaigns/:id'], ['post', '/campaigns/:id/schedule'], ['post', '/campaigns/:id/cancel']]
      .map(([method, path]) => [newsletter, method, path, 'newsletter.manage', ['newsletter.read', 'notifications.manage']]),
  ];
  it.each(cases)('%s %s %s requires %s', (router, method, path, required, unrelated) => {
    expect(gate(router, method, path, [])).toMatchObject({ statusCode: 403 });
    expect(gate(router, method, path, unrelated)).toMatchObject({ statusCode: 403 });
    expect(gate(router, method, path, Array.isArray(required) ? required : [required])).toBe('allowed');
    // The next request after revocation must fail without waiting for UI refresh.
    expect(gate(router, method, path, [])).toMatchObject({ statusCode: 403 });
  });
  it('permits blog read access but rejects writes', () => {
    expect(gate(blogs, 'get', '/admin/posts', ['blogs.read'])).toBe('allowed');
    expect(gate(blogs, 'get', '/admin/posts/:id', ['blogs.read'])).toBe('allowed');
    expect(gate(blogs, 'post', '/admin/posts', ['blogs.read'])).toMatchObject({ statusCode: 403 });
  });
  it('lets notification managers read templates without granting settings access', () => {
    expect(gate(notifications, 'get', '/templates', ['notifications.manage'])).toBe('allowed');
    expect(gate(notifications, 'get', '/templates', ['settings.read'])).toBe('allowed');
    expect(gate(notifications, 'put', '/templates/:name', ['settings.read'])).toMatchObject({ statusCode: 403 });
  });
});
