import { describe, expect, it } from 'vitest';
import {
  PRODUCT_STOREFRONT_STATES,
  PRODUCT_STOREFRONT_STATE_LABELS,
  getProductStorefrontFields,
  getProductStorefrontState,
  getProductStorefrontStateHelp,
} from '../../utils/productStorefrontState';

describe('product storefront state mapping', () => {
  it.each([
    [{ status: 'draft', isEnabled: true }, 'draft'],
    [{ status: 'published', isEnabled: true }, 'published'],
    [{ status: 'published', isEnabled: false }, 'paused'],
    [{ status: 'archived', isEnabled: true }, 'archived'],
    [{ status: 'published' }, 'published'],
    [{ status: 'unknown' }, 'draft'],
    [null, 'draft'],
  ])('maps stored product %j to %s', (product, state) => {
    expect(getProductStorefrontState(product)).toBe(state);
  });

  it.each([
    ['draft', { status: 'draft', isEnabled: true }],
    ['published', { status: 'published', isEnabled: true }],
    ['paused', { status: 'published', isEnabled: false }],
    ['archived', { status: 'archived', isEnabled: false }],
    ['invalid', { status: 'draft', isEnabled: true }],
  ])('maps selected state %s to canonical fields', (state, fields) => {
    expect(getProductStorefrontFields(state)).toEqual(fields);
  });

  it.each(Object.values(PRODUCT_STOREFRONT_STATES))('has a label and help text for %s', (state) => {
    expect(PRODUCT_STOREFRONT_STATE_LABELS[state]).toBeTruthy();
    expect(getProductStorefrontStateHelp(state)).toBeTruthy();
  });

  it('uses draft help for an unknown state', () => {
    expect(getProductStorefrontStateHelp('invalid')).toBe(
      getProductStorefrontStateHelp(PRODUCT_STOREFRONT_STATES.DRAFT),
    );
  });
});
