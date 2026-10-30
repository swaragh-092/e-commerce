import { describe, expect, it } from 'vitest';
import { getPageSections } from '../../utils/designerSections';

describe('getPageSections', () => {
  const pageKeys = {
    home: 'homepage', product: 'productPage', category: 'categoryPage',
    collection: 'catalog', brand: 'brandsPage', blog: 'blogPage',
    account: 'accountPage', cart: 'cartPage', checkout: 'checkoutPage',
    wishlist: 'wishlistPage', search: 'searchPage', 'not-found': 'notFoundPage',
    orders: 'ordersPage',
  };

  it.each(Object.entries(pageKeys))('uses the saved %s sections without leaking homepage content', (page, key) => {
    const sections = [{ id: `${page}-custom`, type: 'rich-text' }];
    const settings = { homepage: { sections: [{ id: 'home-only' }] }, [key]: { sections } };
    expect(getPageSections(settings, page)).toBe(sections);
  });

  it.each(Object.entries(pageKeys))('preserves an intentionally empty %s page', (page, key) => {
    expect(getPageSections({ [key]: { sections: [] } }, page, [{ id: 'fallback' }])).toEqual([]);
  });

  it('only uses template layout sections for the homepage', () => {
    const layout = [{ id: 'template-home' }];
    expect(getPageSections({}, 'home', layout)).toBe(layout);
    expect(getPageSections({}, 'product', layout).map(({ id }) => id)).toEqual([
      'prod-info', 'prod-trust', 'prod-reviews', 'prod-row', 'prod-recent',
    ]);
    expect(getPageSections({}, 'category', layout).map(({ id }) => id)).toEqual([
      'cat-header', 'cat-products', 'cat-recent',
    ]);
  });

  it('returns independent defaults so editing one draft cannot alter another', () => {
    const first = getPageSections(undefined, 'product');
    first[0].enabled = false;
    first.push({ id: 'draft-only' });
    const second = getPageSections(undefined, 'product');
    expect(second[0].enabled).toBe(true);
    expect(second.some(({ id }) => id === 'draft-only')).toBe(false);
  });

  it('handles missing home settings and unsupported pages', () => {
    expect(getPageSections(undefined, 'home')).toEqual([]);
    expect(getPageSections({}, 'unsupported')).toEqual([]);
  });
});
