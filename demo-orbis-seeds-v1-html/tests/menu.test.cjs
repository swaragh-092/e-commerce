// Standalone storefront checks: node --test demo-orbis-seeds-v1-html/tests/menu.test.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

function loadMenu() {
    const context = {
        URL, URLSearchParams,
        document: { getElementById: () => ({ textContent: '' }) },
        window: { location: new URL('https://store.example/product.html') },
        $: () => ({ length: 0, ready() {}, on() {} }),
    };
    vm.runInNewContext(readFileSync(join(__dirname, '../js/common.js'), 'utf8'), context);
    return context;
}

function category(index, childCount = 20) {
    return {
        label: 'Category ' + index, url: '/products?category=category-' + index,
        isVisible: true, sortOrder: index,
        children: Array.from({ length: childCount }, (_, childIndex) => ({
            label: 'Seed ' + index + '-' + childIndex,
            url: '/products?category=seed-' + index + '-' + childIndex,
            isVisible: true, sortOrder: childIndex,
        })),
    };
}

const catalog = children => ({ label: 'Our Products', url: 'product.html', children });
const count = (html, pattern) => (html.match(pattern) || []).length;

test('large catalogs expose bounded previews and links to every remaining category', () => {
    const menu = loadMenu();
    const item = catalog(Array.from({ length: 8 }, (_, index) => category(index)));
    const html = menu.buildDesktopMegaMenu(item);

    assert.equal(count(html, /class="mega-menu-column(?: mega-menu-column-wide)?"/g), 4);
    assert.equal(count(html, /class="mega-menu-more"/g), 4);
    assert.equal(count(html, /href="product\.html\?category=seed-/g), 48);
    assert.match(html, /href="product\.html\?category=category-0" aria-label="More Category 0">More &rarr;/);
    assert.match(html, /class="mega-menu-footer"><a href="product\.html">More categories/);
    assert.match(html, />Seed 0-11</);
    assert.doesNotMatch(html, />Seed 0-12</);
    assert.doesNotMatch(html, />Category 4</);

    // Rendering the desktop preview must not remove entries from the mobile tree.
    const mobile = menu.buildMobileMenuSub(item.children, item.label);
    assert.match(mobile, />Category 7</);
    assert.match(mobile, />Seed 7-19</);
});

test('hidden entries do not consume slots or produce unnecessary More links', () => {
    const menu = loadMenu();
    const children = Array.from({ length: 4 }, (_, index) => category(index, 12));
    children[0].children.unshift({ ...category(98, 0), isVisible: false, sortOrder: -1 });
    children.unshift({ ...category(99), isVisible: false, sortOrder: -1 });
    const html = menu.buildDesktopMegaMenu(catalog(children));

    assert.equal(count(html, /class="mega-menu-column(?: mega-menu-column-wide)?"/g), 4);
    assert.doesNotMatch(html, /mega-menu-more|mega-menu-footer/);
    assert.doesNotMatch(html, /Category 9[89]/);
    assert.match(html, />Seed 0-11</);
});

test('previews honor configured order without mutating the source menu', () => {
    const menu = loadMenu();
    const children = Array.from({ length: 6 }, (_, index) => category(index)).reverse();
    children.forEach(child => child.children.reverse());
    const original = JSON.stringify(children);
    const html = menu.buildDesktopMegaMenu(catalog(children));

    assert.ok(html.indexOf('>Category 0</a>') < html.indexOf('>Category 1</a>'));
    assert.ok(html.indexOf('>Seed 0-0</a>') < html.indexOf('>Seed 0-1</a>'));
    assert.equal(JSON.stringify(children), original);
});

test('parent, nested and leaf categories all use the unified catalogue', () => {
    const menu = loadMenu();
    const branch = category(0, 13);
    branch.url = '/products?category=' + encodeURIComponent('fruit & flowers');
    branch.children[0].children = [category(50, 0)];
    const html = menu.buildDesktopMegaMenu(catalog([branch, category(1, 0)]));

    assert.match(html, /href="product\.html\?category=fruit(?:%20|\+)%26(?:%20|\+)flowers" class="mega-menu-column-title"/);
    assert.match(html, /href="product\.html\?category=fruit(?:%20|\+)%26(?:%20|\+)flowers" aria-label="More Category 0">More &rarr;/);
    assert.match(html, /href="product\.html\?category=seed-0-0">Seed 0-0/);
    assert.match(html, /href="product\.html\?category=seed-0-1">Seed 0-1/);
    assert.match(html, /href="product\.html\?category=category-1" class="mega-menu-column-title"/);
    assert.equal(menu.getMenuItemUrl({ targetType: 'category_tree', url: '/products' }), 'product.html');
    assert.equal(menu.getMenuItemUrl({ ...branch, url: '/products?category=fruit#featured' }), 'product.html?category=fruit#featured');
});

test('More links preserve new-tab behavior and render category labels as text', () => {
    const menu = loadMenu();
    const branch = { ...category(0), label: 'Fruit & <Flowers>', openInNewTab: true };
    const html = menu.buildDesktopMegaMenu(catalog([branch]));

    assert.match(html, /class="mega-menu-column-title" target="_blank">Fruit &amp; &lt;Flowers&gt;/);
    assert.match(html, /href="product\.html\?category=category-0" aria-label="More Fruit &amp; &lt;Flowers&gt;" target="_blank">More &rarr;/);
    assert.doesNotMatch(html, /<Flowers>/);
});

test('fallback category data keeps deep branches and encodes their slugs', () => {
    const menu = loadMenu();
    const item = menu.categoryMenuItem({
        name: 'Fruit', slug: 'fruit & flowers', sortOrder: 7,
        children: [{ name: 'Melons', slug: 'melons', children: [{ name: 'Watermelon', slug: 'water melon' }] }],
    });

    assert.equal(item.url, 'product.html?category=fruit%20%26%20flowers');
    assert.equal(item.sortOrder, 7);
    assert.equal(item.children[0].url, 'product.html?category=melons');
    assert.equal(item.children[0].children[0].url, 'product.html?category=water%20melon');
});

test('other mega menus and headings without destinations keep their links reachable', () => {
    const menu = loadMenu();
    const resources = { label: 'Resources', children: Array.from({ length: 8 }, (_, index) => category(index)) };
    const html = menu.buildDesktopMegaMenu(resources);
    assert.equal(count(html, /class="mega-menu-column"/g), 8);
    assert.match(html, />Seed 7-19</);
    assert.doesNotMatch(html, /mega-menu-catalog|mega-menu-more|mega-menu-footer/);

    const heading = menu.buildDesktopMegaMenu(catalog([{ ...category(0), url: '#' }]));
    assert.match(heading, />Seed 0-19</);
    assert.doesNotMatch(heading, /mega-menu-more/);
    assert.equal(menu.getMenuItemUrl({ url: '/resources', children: [category(0)] }), 'resources.html');
});

test('API fallback renders and caches bounded desktop menus without shortening mobile navigation', async () => {
    const menu = loadMenu();
    const rendered = {};
    const cache = new Map();
    const categories = Array.from({ length: 8 }, (_, index) => ({
        name: 'Crop ' + index, slug: 'crop-' + index,
        children: [{ name: 'Seed ' + index, slug: 'seed-' + index }],
    }));
    menu.API_URL = 'https://api.example/';
    menu.fetch = async url => ({ json: async () => ({ success: true, data: url.endsWith('categories')
        ? categories : { items: [{ label: 'Our Products', url: 'product.html', isVisible: true }] } }) });
    menu.localStorage = { setItem: (key, value) => cache.set(key, value) };
    menu.setActiveLinks = () => {};
    menu.$ = selector => ({
        length: 1,
        html(value) { if (value === undefined) return rendered[selector]; rendered[selector] = value; },
    });
    menu.fetchAndRenderMenu();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(count(rendered['.nav-links'], /class="mega-menu-column"/g), 4);
    assert.match(rendered['.nav-links'], /More categories/);
    assert.match(rendered['.mobile-menu-content'], />Crop 7</);
    assert.match(rendered['.mobile-menu-content'], />Seed 7</);
    assert.match(rendered['.mobile-menu-content'], /class="has-submenu mobile-catalog-menu"/);
    assert.equal(cache.get('orbis_desktop_menu_html_v5'), rendered['.nav-links']);
    assert.equal(cache.get('orbis_mobile_menu_html_v4'), rendered['.mobile-menu-content']);

    // A catalog containing only leaf categories must use the same bounded preview.
    categories.forEach(item => { item.children = []; });
    menu.fetchAndRenderMenu();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(count(rendered['.nav-links'], /class="mega-menu-column"/g), 4);
    assert.match(rendered['.nav-links'], /More categories/);
    assert.match(rendered['.mobile-menu-content'], />Crop 7</);
});
