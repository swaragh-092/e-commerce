// Uses existing client development dependencies and mock APIs only.
// Run: node --test --test-isolation=none demo-orbis-seeds-v1-html/tests/*.test.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require('../../client/node_modules/jsdom');
const jquery = require('../../client/node_modules/jquery');
const root = resolve(__dirname, '..');
const until = async predicate => {
    for (let i = 0; i < 300; i++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Enquiry list did not settle');
};
async function fixture(options = {}) {
    const dom = new JSDOM(readFileSync(resolve(root, 'enquiry-list.html'), 'utf8'), { url: 'https://store.example/enquiry-list.html', runScripts: 'outside-only' });
    const window = dom.window, document = window.document;
    window.$ = window.jQuery = jquery(window);
    window.API_URL = 'https://api.example/api/'; window.APP_URL = 'https://api.example';
    const variants = [
        { id: '100g', sku: 'TOM-100G', optionLabel: 'Pack size: 100 g', isActive: true },
        { id: '500g', sku: 'TOM-500G', optionLabel: 'Pack size: 500 g', isActive: true },
    ];
    const products = [
        { id: 'tomato', slug: 'red-ruby', name: 'Red Ruby', type: 'variable', variants, unit: 'packs', categories: [{ name: 'Tomato', slug: 'tomato' }],
            images: [{ url: 'images/variety-of-seeds/tomato.png' }], description: '<p>A productive <strong>hybrid tomato</strong>.</p><script>window.badDescription = true;</script>',
            attributes: [{ customName: 'Maturity', customValue: '60–65 days', sortOrder: 2 }, { customName: 'Plant habit', customValue: 'Strong', sortOrder: 1 },
                { attribute: { name: 'Fruit weight', unit: 'g' }, value: { value: '150', unitLabel: 'g' }, sortOrder: 3 }, { customName: 'Unit', customValue: 'packs' }] },
        { id: 'melon', slug: 'melon', name: '<img src=x onerror=alert(1)>', sku: 'MEL-03', unit: 'kg', categories: [{ name: 'Melon', slug: 'melon' }], images: [], attributes: [] },
    ];
    const lines = [
        { id: 'tomato', slug: 'red-ruby', name: 'Old tomato name', variantId: '100g', sku: 'OLD-100G', quantity: 1 },
        { id: 'tomato', slug: 'red-ruby', name: 'Old tomato name', variantId: '500g', sku: 'OLD-500G', quantity: 2 },
        { id: 'melon', slug: 'melon', name: 'Melon', quantity: 5 },
    ];
    window.localStorage.setItem('enquiryCart', JSON.stringify(lines));
    const scene = { requests: [], products, pending: new Map(), hold: options.hold, failSlug: options.failSlug };
    window.fetch = async (raw, request = {}) => {
        const url = new URL(raw); scene.requests.push({ url, request });
        if (url.pathname.endsWith('/settings/features')) return { ok: true, json: async () => ({ data: { features: { enquiry: true } } }) };
        if (url.pathname.endsWith('/enquiries')) return { ok: false, json: async () => ({ error: { message: 'Submission unavailable in fixture' } }) };
        const slug = decodeURIComponent(url.pathname.split('/').pop());
        if (scene.hold) await new Promise(resolve => scene.pending.set(slug, resolve));
        if (scene.failSlug === slug) { scene.failSlug = null; throw new Error('Temporary outage'); }
        const product = products.find(item => item.slug === slug);
        if (product) return { ok: true, json: async () => ({ data: product }) };
        throw new Error('Unexpected request: ' + url.pathname);
    };
    for (const file of ['catalog.js', 'enquiry.js']) window.eval(readFileSync(resolve(root, 'js', file), 'utf8'));
    await until(() => document.querySelectorAll('.enquiry-item').length === 3);
    const settled = () => until(() => !Array.from(document.querySelectorAll('.enquiry-details-status')).some(node => node.textContent.includes('Loading product details')));
    if (!options.hold) await settled();
    return { window, document, scene, settled, close: () => window.close() };
}

test('older enquiry selections load category, selected options, descriptions and specifications with one request per product', async () => {
    const app = await fixture();
    try {
        const { document, scene, window } = app;
        const rows = document.querySelectorAll('.enquiry-item');
        assert.match(rows[0].textContent, /Tomato/);
        assert.match(rows[0].textContent, /Pack size: 100 g/);
        assert.match(rows[0].textContent, /SKU: TOM-100G/);
        assert.match(rows[0].textContent, /150g/);
        assert.match(rows[0].textContent, /A productive hybrid tomato\./);
        assert.equal(rows[0].querySelectorAll('.enquiry-item-specs > div').length, 3);
        assert(!document.querySelector('.enquiry-item-info script'));
        assert.equal(window.badDescription, undefined);
        assert.equal(rows[2].querySelector('.enquiry-item-title').textContent, '<img src=x onerror=alert(1)>');
        assert.equal(rows[2].querySelectorAll('img').length, 1);
        const link = new URL(rows[1].querySelector('.enquiry-view-product').href);
        assert.equal(link.searchParams.get('variant'), '500g');
        assert.equal(link.searchParams.get('category'), 'tomato');
        assert.equal(scene.requests.filter(({ url }) => url.pathname.endsWith('/products/red-ruby')).length, 1);
        assert.equal(window.OrbiCatalog.getCart()[0].quantity, 1);
    } finally { app.close(); }
});

test('delayed product details preserve unfinished quantities and focus without restoring removed selections', async () => {
    const app = await fixture({ hold: true });
    try {
        const { document, scene, window } = app;
        await until(() => scene.pending.size === 2);
        const input = document.querySelector('.qty-input');
        input.focus(); input.value = '';
        document.querySelectorAll('.remove-item')[2].click();
        const currentInput = document.querySelector('.qty-input');
        currentInput.focus(); currentInput.value = '';
        scene.hold = false; scene.pending.forEach(release => release());
        await app.settled();
        assert.equal(document.querySelector('.qty-input'), currentInput);
        assert.equal(document.activeElement, currentInput);
        assert.equal(currentInput.value, '');
        assert.equal(document.querySelectorAll('.enquiry-item').length, 2);
        assert.equal(window.OrbiCatalog.getCart().length, 2);
        assert.match(document.querySelector('.enquiry-item-info').textContent, /Maturity/);
        currentInput.dispatchEvent(new window.Event('blur'));
        assert.equal(currentInput.value, '1');
    } finally { app.close(); }
});

test('quantity controls preserve variant identity, enforce bounds and group different units in the summary', async () => {
    const app = await fixture();
    try {
        const { document, window } = app;
        const rows = document.querySelectorAll('.enquiry-item');
        assert(rows[0].querySelector('.minus').disabled);
        rows[0].querySelector('.plus').click();
        assert.equal(window.OrbiCatalog.getCart()[0].quantity, 2);
        assert.equal(window.OrbiCatalog.getCart()[1].quantity, 2);
        const summary = document.getElementById('enquiry-summary-details').textContent;
        assert.match(summary, /Quantity \(packs\)4/);
        assert.match(summary, /Quantity \(kg\)5/);
        const input = rows[0].querySelector('.qty-input');
        input.value = '99999'; input.dispatchEvent(new window.Event('input', { bubbles: true }));
        assert(rows[0].querySelector('.plus').disabled);
        input.value = '-2'; input.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert.equal(input.value, '99999');
        input.value = '1.5'; input.dispatchEvent(new window.Event('blur'));
        assert.equal(input.value, '99999');
        rows[0].querySelector('.minus').click();
        assert.equal(window.OrbiCatalog.getCart()[0].quantity, 99998);
    } finally { app.close(); }
});

test('failed product details can retry while stored selections and quantities remain available', async () => {
    const app = await fixture({ failSlug: 'red-ruby' });
    try {
        const { document, window, scene } = app;
        assert(document.querySelector('.enquiry-details-retry'));
        assert.equal(document.querySelectorAll('.enquiry-item').length, 3);
        document.querySelector('.plus').click();
        document.querySelector('.enquiry-details-retry').click(); await app.settled();
        assert.equal(document.querySelectorAll('.enquiry-details-retry').length, 0);
        assert.match(document.querySelector('.enquiry-item-info').textContent, /Maturity/);
        assert.equal(document.querySelector('.qty-input').value, '2');
        assert.equal(window.OrbiCatalog.getCart()[0].quantity, 2);
        assert.equal(scene.requests.filter(({ url }) => url.pathname.endsWith('/products/red-ruby')).length, 2);
    } finally { app.close(); }
});

test('removing a variant and cancelling or confirming Clear list keeps the correct selections', async () => {
    const app = await fixture();
    try {
        const { document, window } = app;
        document.querySelector('.remove-item').click();
        assert.equal(window.OrbiCatalog.getCart()[0].variantId, '500g');
        document.getElementById('clear-cart-btn').click();
        document.querySelector('.custom-confirm-cancel').click();
        assert.equal(window.OrbiCatalog.getCart().length, 2);
        document.getElementById('clear-cart-btn').click();
        Array.from(document.querySelectorAll('.custom-confirm-ok')).at(-1).click();
        assert.equal(window.OrbiCatalog.getCart().length, 0);
        assert(document.querySelector('.enquiry-list-summary').hidden);
        assert(document.querySelector('.enquiry-empty-state'));
        assert.equal(document.getElementById('enquiry-item-count').textContent, '0 items');
    } finally { app.close(); }
});

test('Enquire now submits selected variants and quantities and retains the list when submission fails', async () => {
    const app = await fixture();
    try {
        const { document, window, scene } = app;
        document.getElementById('cart-enquiry-btn').click();
        assert(document.querySelector('.enquiry-popup-wrapper').classList.contains('active'));
        const form = document.querySelector('.enquiry-form');
        form.querySelector('[name="txtName"]').value = 'Test Customer';
        form.querySelector('[name="txtPhone"]').value = '9876543210';
        form.querySelector('[name="txtEmail"]').value = 'customer@example.test';
        form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
        await until(() => scene.requests.some(({ request }) => request.method === 'POST'));
        await until(() => !form.querySelector('[type="submit"]').disabled);
        const sent = scene.requests.find(({ request }) => request.method === 'POST');
        const payload = JSON.parse(sent.request.body);
        assert.equal(payload.cartItems.length, 3);
        assert.deepEqual(payload.cartItems.slice(0, 2), [
            { product: { id: 'tomato' }, variant: { id: '100g' }, quantity: 1 },
            { product: { id: 'tomato' }, variant: { id: '500g' }, quantity: 2 },
        ]);
        assert.equal(window.OrbiCatalog.getCart().length, 3);
        assert.match(document.querySelector('.custom-toast').textContent, /Submission unavailable/);
    } finally { app.close(); }
});
