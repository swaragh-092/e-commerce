import { describe, expect, it } from 'vitest';
import { isSuperAdminOnlySettingsKey } from '../../utils/permissions';

describe('isSuperAdminOnlySettingsKey', () => {
  it('protects feature, visibility, and store mode settings', () => {
    expect(isSuperAdminOnlySettingsKey('features', 'reviews')).toBe(true);
    expect(isSuperAdminOnlySettingsKey('visibility', 'adminCart')).toBe(true);
    expect(isSuperAdminOnlySettingsKey('general', 'mode')).toBe(true);
  });

  it('allows regular admin settings', () => {
    expect(isSuperAdminOnlySettingsKey('general', 'storeName')).toBe(false);
    expect(isSuperAdminOnlySettingsKey('catalog', 'defaultSort')).toBe(false);
    expect(isSuperAdminOnlySettingsKey('featuresExtra', 'reviews')).toBe(false);
  });
});

import { PERMISSIONS, getFirstAccessibleAdminPath, getPermissionsForUser } from '../../utils/permissions';

describe('Feature permissions and admin landing routes', () => {
  it.each([
    ['orders.read', '/admin/orders'], ['enquiries.read', '/admin/enquiries'],
    ['gallery.read', '/admin/gallery'], ['gallery.manage', '/admin/gallery'],
    ['newsletter.read', '/admin/newsletter'], ['newsletter.manage', '/admin/newsletter'],
    ['newsletter.subscribers_read', '/admin/newsletter'],
    ['notifications.manage', '/admin/email-templates'], ['blogs.read', '/admin/blogs'],
  ])('lands %s users on an accessible page', (permission, path) => {
    expect(getFirstAccessibleAdminPath({ permissions: [permission] })).toBe(path);
  });
  it('does not let legacy grants silently enable independently revoked features', () => {
    const permissions = getPermissionsForUser({ permissions: ['media.update', 'settings.manage', 'notifications.manage'] });
    expect(permissions).not.toContain(PERMISSIONS.GALLERY_READ);
    expect(permissions).not.toContain(PERMISSIONS.NEWSLETTER_READ);
    expect(permissions).not.toContain(PERMISSIONS.NEWSLETTER_SUBSCRIBERS_READ);
    expect(getFirstAccessibleAdminPath({ permissions: [] })).toBeNull();
  });
});
