// Uses the existing client development dependencies; no live API is contacted.
// Run: node --test --test-isolation=none demo-orbis-seeds-v1-html/tests/*.test.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require('../../client/node_modules/jsdom');
const jquery = require('../../client/node_modules/jquery');
const root = resolve(__dirname, '..');
const until = async predicate => {
    for (let i = 0; i < 200; i++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Wishlist did not settle');
};

async function fixture(options = {}) {
    const dom = new JSDOM(readFileSync(resolve(root, 'wishlist.html'), 'utf8'), {
        url: 'https://store.example/wishlist.html', runScripts: 'outside-only',
    });
    const window = dom.window;
    window.jQuery = window.$ = jquery(window);
    window.API_URL = 'https://api.example/api/';
    window.APP_URL = 'https://api.example';
    const variants = [
        { id: '100g', sku: 'TOM-100G', optionLabel: 'Pack size: 100 g', isActive: true },
        { id: '500g', sku: 'TOM-500G', optionLabel: 'Pack size: 500 g', isActive: true },
    ];
    const product = { id: 'tomato', slug: 'red-ruby', name: 'Red Ruby', type: 'variable', variants,
        categories: [{ name: 'Tomato', slug: 'tomato' }], images: [] };
    const scene = { requests: [], notices: [], failedLoad: options.failLoad, failedRemove: options.failRemove,
        items: variants.map(variant => ({ id: 'saved-' + variant.id, productId: product.id, Product: product, variantId: variant.id, variant })) };
    scene.items.push({ id: 'unsafe', productId: 'unsafe', Product: { id: 'unsafe', slug: 'safe-slug', name: '<img src=x onerror=alert(1)>', sku: 'LONG-SKU', images: [] } });
    if (options.missingVariant) scene.items[0] = { id: 'needs-options', productId: product.id, Product: product };
    window.customAlert = (...args) => scene.notices.push(args);
    window.fetch = async (raw, request = {}) => {
        const url = new URL(raw); scene.requests.push({ url, request });
        if (url.pathname.endsWith('/settings/features')) return { ok: true, json: async () => ({ data: { features: { wishlist: true } } }) };
        if (url.pathname.endsWith('/wishlist')) {
            if (scene.failedLoad) { scene.failedLoad = false; throw new Error('Temporary outage'); }
            return { ok: true, json: async () => ({ data: scene.items }) };
        }
        if (url.pathname.endsWith('/products/red-ruby')) return { ok: true, json: async () => ({ data: product }) };
        if (url.pathname.endsWith('/products/safe-slug')) return { ok: true, json: async () => ({ data: scene.items.find(item => item.productId === 'unsafe').Product }) };
        if (request.method === 'DELETE') {
            if (scene.pauseDelete) await new Promise(resolve => { scene.releaseDelete = resolve; });
            if (scene.failedRemove) { scene.failedRemove = false; return { ok: false, json: async () => ({ error: { message: 'Temporary failure' } }) }; }
            if (url.pathname.endsWith('/items')) scene.items = [];
            else scene.items = scene.items.filter(item => !(item.productId === decodeURIComponent(url.pathname.split('/').pop()) && (item.variantId || '') === (url.searchParams.get('variantId') || '')));
            return { ok: true, status: 204 };
        }
        throw new Error('Unexpected request: ' + url.pathname);
    };
    for (const script of ['catalog.js', 'wishlist.js']) window.eval(readFileSync(resolve(root, 'js', script), 'utf8'));
    const document = window.document;
    await until(() => document.getElementById('dynamic-wishlist-container').getAttribute('aria-busy') === 'false');
    const idle = () => until(() => !document.querySelector('[aria-busy="true"]'));
    return { window, document, scene, idle, close: () => window.close() };
}

test('wishlist cards preserve selected variants, safe product links and image fallbacks', async () => {
    const app = await fixture();
    try {
        const { document, window } = app;
        const rows = document.querySelectorAll('.wishlist-item');
        assert.equal(rows.length, 3);
        const url = new URL(rows[1].querySelector('.wishlist-view-product').href);
        assert.equal(url.searchParams.get('variant'), '500g');
        assert.equal(url.searchParams.get('category'), 'tomato');
        assert.match(rows[1].textContent, /Pack size: 500 g/);
        assert.equal(rows[2].querySelector('.wishlist-item-title').textContent, '<img src=x onerror=alert(1)>');
        assert.equal(rows[2].querySelectorAll('img').length, 1);
        const image = rows[0].querySelector('img');
        image.classList.remove('is-placeholder'); image.src = 'missing-photo.jpg';
        image.dispatchEvent(new window.Event('error'));
        assert.equal(image.getAttribute('src'), 'images/orbi-seeds-logo.png');
        assert(image.classList.contains('is-placeholder'));
    } finally { app.close(); }
});

test('remove and clear actions update the correct variant and visible counts while preventing duplicate requests', async () => {
    const app = await fixture();
    try {
        const { document, scene } = app;
        scene.pauseDelete = true;
        const remove = document.querySelector('.remove-wishlist-item');
        remove.click();
        await until(() => scene.releaseDelete);
        assert(remove.disabled);
        remove.click();
        assert.equal(scene.requests.filter(({ request }) => request.method === 'DELETE').length, 1);
        scene.pauseDelete = false; scene.releaseDelete();
        await app.idle();
        assert.equal(document.querySelectorAll('.wishlist-item').length, 2);
        assert.match(document.querySelector('.wishlist-item').textContent, /Pack size: 500 g/);
        assert.equal(document.getElementById('wishlist-item-count').textContent, '2 products');
        assert.equal(document.getElementById('wishlist-summary-count').textContent, '2');
        document.getElementById('clear-wishlist-btn').click(); await app.idle();
        assert(document.querySelector('.wishlist-empty-state'));
        assert(document.querySelector('.wishlist-summary').hidden);
        assert.equal(document.getElementById('header-wishlist-count').textContent, '0');
    } finally { app.close(); }
});

test('moving a saved variant can retry a partial failure without duplicating enquiry quantities', async () => {
    const app = await fixture({ failRemove: true });
    try {
        const { document, window, scene } = app;
        document.querySelector('.move-to-cart-btn').click(); await app.idle();
        let cart = window.OrbiCatalog.getCart();
        assert.equal(cart.length, 1);
        assert.equal(cart[0].variantId, '100g');
        assert.equal(cart[0].quantity, 1);
        assert.equal(document.querySelectorAll('.wishlist-item').length, 3);
        assert(scene.notices.some(notice => String(notice[1]).includes('Could not remove')));
        document.querySelector('.move-to-cart-btn').click(); await app.idle();
        cart = window.OrbiCatalog.getCart();
        assert.equal(cart[0].quantity, 1);
        assert.equal(document.querySelectorAll('.wishlist-item').length, 2);
        assert.match(document.querySelector('.wishlist-item').textContent, /Pack size: 500 g/);
    } finally { app.close(); }
});

test('wishlist loading failures can retry and incomplete selections lead back to product options', async () => {
    const app = await fixture({ failLoad: true, missingVariant: true });
    try {
        const { document, window } = app;
        assert(document.querySelector('.retry-wishlist'));
        assert(document.querySelector('.wishlist-summary').hidden);
        document.querySelector('.retry-wishlist').click(); await app.idle();
        assert.equal(document.querySelectorAll('.wishlist-item').length, 3);
        assert(!document.querySelector('.wishlist-summary').hidden);
        document.querySelector('.move-to-cart-btn').click(); await app.idle();
        assert.equal(document.querySelector('.wishlist-view-product').textContent, 'Choose options');
        assert.equal(document.querySelectorAll('.wishlist-item').length, 3);
        assert.equal(window.OrbiCatalog.getCart().length, 0);
    } finally { app.close(); }
});

test('the bulk enquiry action transfers each saved variant and shows the empty state', async () => {
    const app = await fixture();
    try {
        const { document, window } = app;
        document.getElementById('move-all-to-cart-btn').click(); await app.idle();
        const cart = window.OrbiCatalog.getCart();
        assert.equal(cart.length, 3);
        assert.deepEqual(Array.from(cart, line => line.variantId), ['100g', '500g', null]);
        assert(cart.every(line => line.quantity === 1));
        assert(document.querySelector('.wishlist-empty-state'));
        assert(document.querySelector('.wishlist-summary').hidden);
        assert.equal(document.getElementById('wishlist-item-count').textContent, '0 products');
    } finally { app.close(); }
});
