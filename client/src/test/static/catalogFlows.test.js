import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { product } from './catalog.fixtures';

const require = createRequire(import.meta.url);
const jquery = readFileSync(require.resolve('jquery/dist/jquery.js'), 'utf8');
const script = (name) => readFileSync(resolve(import.meta.dirname, `../../../../demo-orbis-seeds-v1-html/js/${name}.js`), 'utf8');
const response = (data, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => data, text: async () => JSON.stringify(data) });
const form = `<div class="enquiry-popup-wrapper"><form class="enquiry-form">
  <div class="form-group"><input name="txtProduct" required></div><div class="form-group"><input name="txtQuantity" required></div>
  <input name="txtName"><input name="txtPhone"><input name="txtEmail"><input name="orbis"><textarea name="txtMessage"></textarea>
  <input name="chkNewsletter" type="checkbox"><button type="submit">Submit</button></form></div>`;
let dom;
async function mount({ list = false, query = '?category=flowers', products = [product], detailProduct, saved = [], cart = [], fail = '', deferSubmission, features = { wishlist: true, enquiry: true } } = {}) {
  dom = new JSDOM(`<div id="header-wishlist-count"></div><div id="header-enquiry-count"></div>
    ${list ? '<div class="cart-wrapper"><h1>Enquiry List</h1><div id="dynamic-cart-container"></div><div class="cart-buttons"><button id="cart-enquiry-btn">Submit enquiry</button></div></div>' : '<div class="products-content"></div><ul class="products-list"></ul>'}
    <div id="dynamic-wishlist-container"></div><div class="cart-buttons"><button id="move-all-to-cart-btn">Move all</button><button id="clear-wishlist-btn">Clear</button></div>${form}`, {
    url: `http://localhost:3000/${list ? 'enquiry-list' : 'products'}.html${query}`, runScripts: 'outside-only',
  });
  const w = dom.window;
  w.eval(jquery);
  w.API_URL = 'https://api.example.com/api/'; w.APP_URL = 'https://api.example.com/';
  w.scrollTo = vi.fn();
  w.IntersectionObserver = class { observe() {} disconnect() {} };
  let wishlist = saved;
  w.fetch = vi.fn(async (url, options = {}) => {
    if (url.endsWith('settings/features')) return response({ success: true, data: { features } });
    if (url.includes('/categories')) return response({ success: true, data: [] });
    if (url.includes('/products?')) return response({ success: true, data: products, meta: { totalPages: 1 } });
    if (/\/products\//.test(url)) return response({ success: true, data: detailProduct || products[0] });
    if (url.endsWith('/enquiries')) {
      if (deferSubmission) await deferSubmission;
      return fail === 'enquiry' ? response({ success: false, error: { message: 'Submission failed' } }, false) : response({ success: true });
    }
    if (url.endsWith('/wishlist')) return response({ success: true, data: wishlist });
    if (url.includes('/wishlist/items')) {
      if (fail === 'wishlist') return response({ success: false, error: { message: 'Wishlist failed' } }, false);
      if (options.method === 'POST') {
        const data = JSON.parse(options.body);
        wishlist = [...wishlist, { ...data, Product: products[0], variant: product.variants.find(v => v.id === data.variantId) }];
      } else {
        const variantId = new URL(url).searchParams.get('variantId');
        wishlist = wishlist.filter(item => item.variantId !== variantId);
      }
      return response({ success: true });
    }
    throw new Error(`Unmocked request: ${url}`);
  });
  w.localStorage.setItem('enquiryCart', JSON.stringify(cart));
  w.eval(script('catalog')); w.eval(script('enquiry')); w.eval(script('wishlist'));
  if (!list) w.eval(script('products'));
  if (features.wishlist !== false) await waitFor(() => expect(w.fetch.mock.calls.some(([url]) => url.endsWith('/wishlist'))).toBe(true));
  if (!list) await waitFor(() => expect(w.document.querySelector('.product-sec')).not.toBeNull());
  await new Promise(r => setTimeout(r, 10));
  return w;
}
const choose = (w, colour = 'red', days = '50') => {
  for (const [id, value] of [['colour', colour], ['days', days]]) {
    const select = w.document.querySelector(`[data-attribute="${id}"]`);
    select.value = value; select.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
};
const submit = (w) => {
  const $ = w.jQuery;
  $('input[name="txtName"]').val('D’Souza'); $('input[name="txtPhone"]').val('9876543210'); $('input[name="txtEmail"]').val('test@example.com');
  $('.enquiry-form').trigger('submit');
};
const writes = w => w.fetch.mock.calls.filter(([, o]) => o?.method === 'POST');
afterEach(() => dom?.window.close());

describe('Orbi product choices', () => {
  it('loads variant metadata, blocks unselected actions, updates the image and disables impossible combinations', async () => {
    const w = await mount();
    expect(w.fetch.mock.calls.some(([url]) => url.includes('include=attributes,variants'))).toBe(true);
    w.document.querySelector('.add-enquiry-list').click();
    w.document.querySelector('.wishlist-heart-btn').click();
    w.document.querySelector('.open-enquiry-popup').click();
    expect(w.OrbiCatalog.getCart()).toHaveLength(0);
    expect(writes(w)).toHaveLength(0);
    expect(w.document.querySelector('.enquiry-popup-wrapper').classList.contains('active')).toBe(false);
    choose(w, 'blue');
    expect(w.document.querySelector('[data-attribute="days"] option[value="60"]').disabled).toBe(true);
    choose(w);
    expect(w.document.querySelector('.products-left img').src).toBe('https://api.example.com/red.jpg');
    expect(w.document.querySelector('.product-selected-price').textContent).toBe('');
    w.document.querySelector('.add-enquiry-list').click();
    choose(w, 'blue'); w.document.querySelector('.add-enquiry-list').click();
    expect(w.OrbiCatalog.getCart().map(i => i.variantId)).toEqual(['v1', 'v2']);
    expect(w.document.getElementById('header-enquiry-count').textContent).toBe('2');
  });
  it('restores a saved option from the URL and displays only its server-resolved price', async () => {
    const priced = { ...product, variants: product.variants.map(v => ({ ...v, price: 100, unitPrice: 80 })) };
    const w = await mount({ products: [priced], query: '?category=flowers&slug=marigold&variant=v2' });
    expect(w.document.querySelector('.product-sec').orbiVariant.id).toBe('v2');
    expect(w.document.querySelector('.product-selected-price').textContent).toBe('Price: 80.00');
    w.document.querySelector('.reset-product-options').click();
    expect(w.document.querySelector('.product-sec').orbiVariant).toBeNull();
    expect(w.location.search).not.toContain('variant=');
  });
  it('supports simple products and does not interpret product text as markup', async () => {
    const simple = { ...product, type: 'simple', variants: [], name: '<img src=x onerror=alert(1)>', description: '<p>Details</p><script>alert(1)</script>' };
    const w = await mount({ products: [simple] });
    expect(w.document.querySelector('.products-right h3').textContent).toBe(simple.name);
    expect(w.document.querySelector('.product-description script')).toBeNull();
    w.document.querySelector('.add-enquiry-list').click();
    expect(w.OrbiCatalog.getCart()[0].variantId).toBeNull();
  });
  it('keeps an unavailable saved variant unselected instead of replacing it silently', async () => {
    const w = await mount({ query: '?category=flowers&slug=marigold&variant=deleted' });
    expect(w.document.querySelector('.product-sec').orbiVariant).toBeNull();
    expect(w.document.querySelector('.product-selection-status').textContent).toContain('no longer available');
  });
  it('does not treat an empty SKU as a requested variant', async () => {
    const w = await mount({ products: [{ ...product, variants: product.variants.map(v => ({ ...v, sku: null })) }] });
    expect(w.document.querySelector('.product-sec').orbiVariant).toBeNull();
    expect(w.document.querySelector('.add-enquiry-list').getAttribute('aria-disabled')).toBe('true');
  });
  it('opens a wishlist link without a category and retains the requested variant', async () => {
    const w = await mount({ query: '?slug=marigold&variant=v1' });
    expect(w.document.querySelector('.product-sec').orbiVariant.id).toBe('v1');
    expect(w.fetch.mock.calls.some(([url]) => url.includes('products/marigold?include=categories,attributes,variants'))).toBe(true);
  });
  it('loads a linked product beyond the first category page without duplicating it on append', async () => {
    const other = { ...product, id: 'other', slug: 'other' };
    const w = await mount({ products: [other], detailProduct: product, query: '?category=flowers&slug=marigold&variant=v1' });
    expect(w.document.querySelector('.product-sec').orbiVariant.id).toBe('v1');
    w.renderProducts([product], w.document.querySelector('.products-content'), w.document.querySelector('.products-list'), null, true);
    expect(w.document.querySelectorAll('.product-sec')).toHaveLength(2);
  });
  it('supports older SKUs without option metadata and products with no active options', async () => {
    const legacy = { ...product, variants: product.variants.slice(0, 2).map(v => ({ ...v, options: [] })) };
    const w = await mount({ products: [legacy] });
    const select = w.document.querySelector('select'); select.value = 'v2'; select.dispatchEvent(new w.Event('change', { bubbles: true }));
    expect(w.document.querySelector('.product-sec').orbiVariant.id).toBe('v2');
    const host = w.document.querySelector('.product-sec');
    w.OrbiCatalog.mountOptions(host, { ...product, variants: [] });
    expect(host.querySelector('.product-selection-status').textContent).toContain('No options');
    expect(() => w.OrbiCatalog.actionLine(host.querySelector('.add-enquiry-list'))).toThrow('choose all');
  });
  it('honours resolved feature settings and shares the settings request across both lists', async () => {
    const w = await mount({ features: { wishlist: false, enquiry: false } });
    expect(w.getComputedStyle(w.document.querySelector('.wishlist-heart-btn')).display).toBe('none');
    expect(w.getComputedStyle(w.document.querySelector('.add-enquiry-list')).display).toBe('none');
    expect(w.fetch.mock.calls.filter(([url]) => url.endsWith('/settings/features'))).toHaveLength(1);
    expect(w.fetch.mock.calls.some(([url]) => url.endsWith('/wishlist'))).toBe(false);
  });
});

describe('Orbi wishlist variants', () => {
  it('saves and removes the exact selected variant and updates the selected heart', async () => {
    const w = await mount(); choose(w);
    const heart = w.document.querySelector('.wishlist-heart-btn'); heart.click(); heart.click();
    await waitFor(() => expect(heart.getAttribute('aria-pressed')).toBe('true'));
    expect(writes(w).filter(([url]) => url.endsWith('wishlist/items'))).toHaveLength(1);
    expect(JSON.parse(writes(w)[0][1].body)).toEqual({ productId: 'product-1', variantId: 'v1' });
    choose(w, 'blue'); expect(heart.getAttribute('aria-pressed')).toBe('false');
    choose(w); heart.click();
    await waitFor(() => expect(heart.getAttribute('aria-pressed')).toBe('false'));
    expect(w.fetch.mock.calls.some(([url, options]) => url.endsWith('items/product-1?variantId=v1') && options.method === 'DELETE')).toBe(true);
  });
  it('preserves the row and heart when a wishlist write fails', async () => {
    const w = await mount({ fail: 'wishlist', saved: [{ productId: product.id, variantId: 'v1', Product: product, variant: product.variants[0] }] });
    choose(w); w.document.querySelector('.remove-wishlist-item').click();
    await waitFor(() => expect(w.document.querySelector('.custom-toast-content').textContent).toContain('Wishlist failed'));
    expect(w.document.querySelector('.wishlist-heart-btn').getAttribute('aria-pressed')).toBe('true');
    expect(w.document.querySelectorAll('#dynamic-wishlist-container .cart-inner')).toHaveLength(1);
  });
  it('moves two different variants without combining them and carries their options and images', async () => {
    const saved = product.variants.slice(0, 2).map(variant => ({ productId: product.id, variantId: variant.id, Product: product, variant }));
    const w = await mount({ saved });
    w.document.getElementById('move-all-to-cart-btn').click();
    await waitFor(() => expect(w.document.getElementById('header-wishlist-count').textContent).toBe('0'));
    expect(w.OrbiCatalog.getCart().map(i => i.variantId)).toEqual(['v1', 'v2']);
    expect(w.OrbiCatalog.getCart()[0].variantLabel).toContain('colour: red');
    expect(w.document.getElementById('header-enquiry-count').textContent).toBe('2');
  });
  it('retains a legacy product-only wishlist entry until the customer chooses its options', async () => {
    const w = await mount({ saved: [{ productId: product.id, variantId: null, Product: product }] });
    w.document.querySelector('.move-to-cart-btn').click();
    await waitFor(() => expect(w.document.querySelector('.cart-bottom a')).not.toBeNull());
    expect(w.OrbiCatalog.getCart()).toHaveLength(0);
    expect(w.document.getElementById('header-wishlist-count').textContent).toBe('1');
  });
  it('does not increase enquiry quantity again when retrying a move after removal failed', async () => {
    const w = await mount({ fail: 'wishlist', saved: [{ id: 'saved-item', productId: product.id, variantId: 'v1', Product: product, variant: product.variants[0] }] });
    w.document.querySelector('.move-to-cart-btn').click();
    await waitFor(() => expect(w.document.querySelector('.custom-toast-content')?.textContent).toContain('Could not remove'));
    await waitFor(() => expect(w.document.querySelector('.move-to-cart-btn').hasAttribute('aria-busy')).toBe(false));
    w.document.querySelector('.move-to-cart-btn').click();
    await waitFor(() => expect(w.fetch.mock.calls.filter(([url, options]) => url.includes('wishlist/items') && options.method === 'DELETE')).toHaveLength(2));
    expect(w.OrbiCatalog.getCart()[0].quantity).toBe(1);
  });
});

describe('Orbi variant enquiries', () => {
  it('submits a single selected variant, quantity and a useful default message', async () => {
    const w = await mount(); choose(w, 'blue'); w.document.querySelector('.open-enquiry-popup').click();
    expect(w.document.querySelector('[name="txtProduct"]').value).toContain('colour: blue');
    w.jQuery('[name="txtQuantity"]').val(3); submit(w);
    await waitFor(() => expect(writes(w).some(([url]) => url.endsWith('/enquiries'))).toBe(true));
    expect(JSON.parse(writes(w).find(([url]) => url.endsWith('/enquiries'))[1].body)).toMatchObject({ productId: 'product-1', variantId: 'v2', quantity: 3, message: expect.any(String) });
  });
  it('edits and removes the exact enquiry line and restores invalid quantities', async () => {
    const cart = product.variants.slice(0, 2).map(v => ({ ...product, id: product.id, variantId: v.id, quantity: 2, variantLabel: v.sku }));
    const w = await mount({ list: true, cart });
    w.document.querySelector('.qty-btn.plus').click();
    expect(w.OrbiCatalog.getCart().map(i => i.quantity)).toEqual([3, 2]);
    w.jQuery('.qty-input').first().val('1.5').trigger('change');
    expect(w.OrbiCatalog.getCart()[0].quantity).toBe(3);
    w.document.querySelector('.remove-item').click();
    expect(w.OrbiCatalog.getCart().map(i => i.variantId)).toEqual(['v2']);
  });
  it('includes each variant in a list enquiry, keeps failed submissions and preserves items added during submission', async () => {
    let done;
    const deferred = new Promise(resolve => { done = resolve; });
    const cart = product.variants.slice(0, 2).map(v => ({ id: product.id, slug: product.slug, name: product.name, variantId: v.id, quantity: 2 }));
    const w = await mount({ list: true, cart, deferSubmission: deferred });
    w.document.getElementById('cart-enquiry-btn').click(); submit(w);
    await waitFor(() => expect(writes(w).some(([url]) => url.endsWith('/enquiries'))).toBe(true));
    const payload = JSON.parse(writes(w).find(([url]) => url.endsWith('/enquiries'))[1].body);
    expect(payload.cartItems.map(i => [i.variant.id, i.quantity])).toEqual([['v1', 2], ['v2', 2]]);
    w.OrbiCatalog.addToCart(w.OrbiCatalog.line(product, product.variants[0]));
    done();
    await waitFor(() => expect(w.document.querySelector('.enquiry-popup-wrapper').classList.contains('active')).toBe(false));
    expect(w.OrbiCatalog.getCart().map(i => [i.variantId, i.quantity])).toEqual([['v1', 1]]);
  });
  it('retains the form and enquiry list after submission fails', async () => {
    const cart = [{ id: product.id, slug: product.slug, name: product.name, variantId: 'v1', quantity: 2 }];
    const w = await mount({ list: true, cart, fail: 'enquiry' });
    w.document.getElementById('cart-enquiry-btn').click(); submit(w);
    await waitFor(() => expect(w.document.querySelector('.custom-toast-content')?.textContent).toContain('Submission failed'));
    expect(w.OrbiCatalog.getCart()[0].quantity).toBe(2);
    expect(w.document.querySelector('.enquiry-popup-wrapper').classList.contains('active')).toBe(true);
  });
});
