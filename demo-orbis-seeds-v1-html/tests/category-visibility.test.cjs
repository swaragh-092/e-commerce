const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('../../client/node_modules/jsdom');
const jquery = require('../../client/node_modules/jquery');
const source = name => readFileSync(join(__dirname, '../js/', name), 'utf8');
const populated = [{ id: 'fruit', name: 'Fruit', slug: 'fruit', parentId: null,
    children: [{ id: 'leaf', name: 'Watermelon', slug: 'watermelon', parentId: 'fruit', children: [] }] }];
const response = data => ({ ok: true, json: async () => ({ success: true, data }) });
const until = async predicate => {
    for (let attempt = 0; attempt < 200; attempt++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Category view did not settle');
};

function fixture(markup, page) {
    const dom = new JSDOM(markup, { url: 'https://store.example/' + page, runScripts: 'outside-only' });
    dom.window.$ = dom.window.jQuery = jquery(dom.window);
    dom.window.API_URL = 'https://api.example/api/';
    dom.window.APP_URL = 'https://api.example/';
    dom.window.eval(source('catalog.js'));
    return dom;
}

test('public menu opts in and ignores the old unfiltered browser cache', async () => {
    const cache = new Map([['orbis_desktop_menu_html_v5', 'Empty'], ['orbis_mobile_menu_html_v4', 'Empty']]);
    const requests = [];
    const rendered = {};
    const context = { URL, URLSearchParams, console,
        document: { getElementById: () => ({ textContent: '' }) },
        window: { location: new URL('https://store.example/product.html') },
        localStorage: { getItem: key => cache.get(key), setItem: (key, value) => cache.set(key, value) },
        $: selector => ({ length: 1, ready() {}, on() {}, html(value) {
            if (value === undefined) return rendered[selector];
            rendered[selector] = value;
        } }),
        fetch: async url => {
            requests.push(url);
            return response(new URL(url).pathname.endsWith('/categories') ? populated : { items: [{ label: 'Our Products', targetType: 'category_tree', isVisible: true }] });
        },
    };
    vm.runInNewContext(source('common.js'), context);
    context.API_URL = 'https://api.example/api/';
    context.setActiveLinks = () => {};
    context.applyCachedMenu();
    assert.equal(rendered['.nav-links'], undefined);
    await context.fetchAndRenderMenu();
    assert.equal(requests.length, 2);
    assert(requests.every(url => new URL(url).searchParams.get('hideEmpty') === 'true'));
    assert.match(rendered['.nav-links'], /Fruit/);
    assert(cache.has('orbis_desktop_menu_populated_v1'));
    assert(cache.has('orbis_mobile_menu_populated_v1'));
});

test('category browser requests only populated branches', async () => {
    const dom = fixture('<div class="products-inner-wrapper"></div>', 'product.html');
    try {
        const requests = [];
        dom.window.fetch = async url => { requests.push(url); return response(populated); };
        dom.window.eval(source('categories.js'));
        await until(() => dom.window.document.querySelector('.products-inner-wrapper').getAttribute('aria-busy') === 'false');
        assert.equal(new URL(requests[0]).searchParams.get('hideEmpty'), 'true');
        assert.match(dom.window.document.body.textContent, /Fruit/);
        assert.doesNotMatch(dom.window.document.body.textContent, /Empty/);
    } finally { dom.window.close(); }
});

test('product category metadata uses the filtered endpoint and a separate cache', async () => {
    const dom = fixture('<ul class="breadcrumb"></ul>', 'products.html?category=watermelon');
    try {
        const requests = [];
        dom.window.sessionStorage.setItem('orbis_categories_data', JSON.stringify([{ name: 'Empty', slug: 'empty' }]));
        dom.window.fetch = async url => { requests.push(url); return response(populated); };
        dom.window.eval(source('products.js'));
        await until(() => dom.window.sessionStorage.getItem('orbis_categories_populated_v1'));
        assert(requests.every(url => new URL(url).searchParams.get('hideEmpty') === 'true'));
        assert.match(dom.window.document.body.textContent, /Fruit/);
        assert.doesNotMatch(dom.window.document.body.textContent, /Empty/);
    } finally { dom.window.close(); }
});

for (const fallback of [false, true]) {
    test('homepage category data opts in' + (fallback ? ' on its fallback request too' : ''), async () => {
        const dom = fixture('<div id="orbis-home-section-categories"></div>', 'index.html');
        try {
            const requests = [];
            dom.window.fetch = async url => {
                requests.push(url);
                if (url.includes('api-builder')) {
                    if (fallback) throw new Error('API Builder unavailable');
                    return response({ categories: populated });
                }
                return response(populated);
            };
            dom.window.eval(source('index.js'));
            await until(() => dom.window.document.querySelector('#orbis-home-section-categories').children.length);
            assert.equal(requests.length, fallback ? 2 : 1);
            assert(requests.every(url => new URL(url).searchParams.get('hideEmpty') === 'true'));
            assert.match(dom.window.document.body.textContent, /Watermelon/);
            dom.window.renderHomeCategories([], '');
            assert.equal(dom.window.document.querySelector('#orbis-home-section-categories').children.length, 0);
        } finally { dom.window.close(); }
    });
}

for (const categories of [populated, []]) {
    test('sitemap shows ' + (categories.length ? 'the filtered hierarchy' : 'no empty categories'), async () => {
        const dom = fixture(readFileSync(join(__dirname, '../sitemap.html'), 'utf8'), 'sitemap.html');
        try {
            const requests = [];
            dom.window.fetch = async url => { requests.push(url); return response(categories); };
            dom.window.eval(source('sitemap.js'));
            const list = dom.window.document.getElementById('sitemap-categories');
            await until(() => list.getAttribute('aria-busy') === 'false');
            assert.equal(new URL(requests[0]).searchParams.get('hideEmpty'), 'true');
            assert.equal(list.querySelectorAll('a').length, categories.length ? 2 : 0);
            if (categories.length) {
                assert.equal(list.querySelector('a').getAttribute('href'), 'product.html?cat=fruit');
                assert.equal(list.querySelectorAll('a')[1].getAttribute('href'), 'products.html?category=watermelon');
            }
        } finally { dom.window.close(); }
    });
}
