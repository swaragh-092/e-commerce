import { describe, expect, it } from 'vitest';
import { isAdminMenuItemVisible } from '../../utils/adminMenuVisibility';

const brandsItem = {
  text: 'Brands',
  path: '/admin/brands',
  feature: 'brands',
};

const ordersItem = {
  text: 'Orders',
  path: '/admin/orders',
  feature: 'orders',
};

describe('isAdminMenuItemVisible', () => {
  it('shows the Brands entry when the brands capability is on', () => {
    expect(isAdminMenuItemVisible(brandsItem, {
      mode: 'ecommerce',
      features: { brands: true },
      visibility: {},
    })).toBe(true);
  });

  it('removes the Brands entry when the brands capability is off', () => {
    expect(isAdminMenuItemVisible(brandsItem, {
      mode: 'ecommerce',
      features: { brands: false },
      visibility: {},
    })).toBe(false);
  });

  it('removes entries while the feature map has not resolved', () => {
    expect(isAdminMenuItemVisible(brandsItem, {
      mode: 'ecommerce',
      features: null,
      visibility: {},
    })).toBe(false);
  });

  it('requires the admin presentation switch for tier-1 entries', () => {
    expect(isAdminMenuItemVisible(ordersItem, {
      mode: 'ecommerce',
      features: { orders: true },
      visibility: { admin: { orders: false }, storefront: { orders: true } },
    })).toBe(false);

    expect(isAdminMenuItemVisible(ordersItem, {
      mode: 'ecommerce',
      features: { orders: true },
      visibility: { admin: { orders: true } },
    })).toBe(true);
  });

  it('keeps optional entries independent of the storefront switch', () => {
    expect(isAdminMenuItemVisible(brandsItem, {
      mode: 'ecommerce',
      features: { brands: true },
      visibility: { admin: { brands: false }, storefront: { brands: false } },
    })).toBe(true);
  });

  it('enforces mode, permission, and role constraints', () => {
    expect(isAdminMenuItemVisible({ ...ordersItem, mode: 'ecommerce' }, {
      mode: 'catalog',
      features: { orders: true },
      visibility: { admin: { orders: true } },
    })).toBe(false);

    expect(isAdminMenuItemVisible({ ...brandsItem, permission: 'brands.read' }, {
      mode: 'ecommerce',
      features: { brands: true },
      visibility: {},
      hasPermission: () => false,
    })).toBe(false);

    expect(isAdminMenuItemVisible({ text: 'Features', role: 'super_admin' }, {
      mode: 'ecommerce',
      features: {},
      visibility: {},
      hasRole: () => false,
    })).toBe(false);
  });
});
