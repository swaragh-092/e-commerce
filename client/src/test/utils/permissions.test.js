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
