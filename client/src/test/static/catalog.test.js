import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { product } from './catalog.fixtures';

let dom;
const mount = () => {
  dom = new JSDOM('', { url: 'http://localhost:3000/products.html', runScripts: 'outside-only' });
  dom.window.APP_URL = 'https://api.example.com/';
  dom.window.eval(readFileSync(resolve(import.meta.dirname, '../../../../demo-orbis-seeds-v1-html/js/catalog.js'), 'utf8'));
  return dom.window.OrbiCatalog;
};
afterEach(() => dom?.window.close());

describe('Orbi variant and enquiry identities', () => {
  it('requires a complete active combination and rejects combinations that do not exist', () => {
    const c = mount();
    expect(c.matchVariant(product, { colour: 'red' })).toBeNull();
    expect(c.matchVariant(product, { colour: 'red', days: '50' }).id).toBe('v1');
    expect(c.matchVariant(product, { colour: 'blue', days: '60' })).toBeNull();
    expect(c.groups(product).find(g => g.id === 'days').values).toHaveLength(2);
  });
  it('keeps two variants separate, merges only an exact match and preserves their deep links and images', () => {
    const c = mount();
    c.addToCart(c.line(product, product.variants[0]));
    c.addToCart(c.line(product, product.variants[1]));
    c.addToCart(c.line(product, product.variants[0]));
    expect(c.getCart().map(i => [i.variantId, i.quantity])).toEqual([['v1', 2], ['v2', 1]]);
    expect(c.productUrl(c.getCart()[0])).toContain('variant=v1');
    expect(c.getCart()[0].image).toBe('https://api.example.com/red.jpg');
  });
  it('recovers from invalid storage without inventing a variant for legacy items', () => {
    const c = mount();
    dom.window.localStorage.setItem('enquiryCart', '{invalid');
    expect(c.getCart()).toEqual([]);
    dom.window.localStorage.setItem('enquiryCart', JSON.stringify([{ id: 'legacy', name: 'Legacy', quantity: '2' }]));
    expect(c.getCart()[0]).toMatchObject({ id: 'legacy', quantity: 2, variantId: null });
    expect(c.quantity('1.5')).toBeNull();
    expect(c.quantity(0)).toBeNull();
  });
  it('uses attribute labels and units and rejects unsafe image schemes', () => {
    const c = mount();
    expect(c.valueLabel({ displayLabel: '50', unitLabel: 'g' })).toBe('50g');
    expect(c.valueLabel({ value: '50g', unitLabel: 'g' })).toBe('50g');
    expect(c.imageUrl('javascript:alert(1)')).toBe('images/default-image.png');
  });
});
