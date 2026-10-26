// Standalone storefront checks: node --test demo-orbis-seeds-v1-html/tests/categories.test.cjs
// Requires Chrome; set CHROME_BIN if its executable is not google-chrome.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');

async function checkCategories() {
    const results = [];
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const select = () => document.getElementById('catalog-cat');
    const names = () => Array.from(document.querySelectorAll('.product-inner h3'), heading => heading.textContent);
    const choose = (name, value) => {
        const field = document.getElementById('catalog-' + name);
        assert(field, 'Missing ' + name + ' selector');
        field.value = value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const reset = (query = '') => {
        history.replaceState({}, '', location.pathname + query);
        handleUrlParams();
    };
    const check = async (name, callback) => {
        try { await callback(); results.push({ name, passed: true }); }
        catch (error) { results.push({ name, passed: false, error: error.message }); }
    };
    for (let attempt = 0; attempt < 100 && !categoriesLoaded; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    await check('direct category URL selects Vegetables and paginates its children', () => {
        assert(select(), 'Missing Category selector');
        assert(select().value === 'vegetables', 'Vegetables is not selected');
        assert(select().selectedOptions[0].textContent === 'Vegetables', 'Wrong category label');
        assert(document.querySelector('label[for="catalog-cat"]').textContent === 'Category', 'Wrong field label');
        assert(!document.getElementById('catalog-browse'), 'Old Show filter is still present');
        assert(names().length === 12 && names()[0] === 'Vegetable-01', 'Wrong category results');
        assert(document.getElementById('catalog-results-status').textContent.includes('of 14 categories'), 'Wrong total');
    });
    await check('category changes clear search and page, preserve sorting and use one history entry', () => {
        reset('?cat=vegetables&q=vegetable&page=2&sort=name_desc&limit=12');
        const historyLength = history.length;
        choose('cat', 'fruits');
        assert(location.search === '?cat=fruits&sort=name_desc&limit=12', 'Stale search/page or lost sort/limit: ' + location.search);
        assert(history.length === historyLength + 1, 'Switch created duplicate history entries');
        assert(document.querySelector('.product-heading').textContent === 'Fruits', 'Heading did not update');
        assert(document.querySelector('.breadcrumb').textContent.includes('Fruits'), 'Breadcrumb did not update');
        assert(document.getElementById('catalog-q').value === '', 'Search field did not clear');
        assert(names().join() === 'Melons', 'Wrong subcategories');
        assert(window.fetchCount === 1, 'Category tree was fetched again');
    });
    await check('category cards and the Go Back button synchronize the nested selection', () => {
        reset();
        assert(select().value === '', 'Root selection is not All categories');
        assert(names().join() === 'Flowers,Fruits,Other Crops,Vegetables', 'Root categories missing');
        Array.from(document.querySelectorAll('.product-inner')).find(card => card.querySelector('h3').textContent === 'Fruits').click();
        assert(select().value === 'fruits', 'Card navigation did not select Fruits');
        document.querySelector('.product-inner').click();
        assert(select().value === 'melons', 'Nested category not selected');
        assert(select().selectedOptions[0].textContent === '— Melons', 'Hierarchy missing from options');
        assert(names().join() === 'Watermelon', 'Nested results are wrong');
        document.querySelector('.back-btn').click();
        assert(select().value === 'fruits' && names().join() === 'Melons', 'Go Back is out of sync');
    });
    await check('Clear filters returns to all categories', () => {
        reset('?cat=vegetables&q=vegetable&page=2&sort=name_desc');
        document.querySelector('.catalog-clear').click();
        assert(!new URLSearchParams(location.search).has('cat'), 'Category was not cleared');
        assert(select().value === '', 'Selector did not clear');
        assert(document.querySelector('.product-heading').textContent === 'Categories', 'Heading did not reset');
        assert(names().length === 4, 'Root cards not restored');
    });
    await check('browser Back and Forward preserve historical category, search and page', async () => {
        reset('?cat=vegetables&q=vegetable&page=2&sort=name_desc&limit=12');
        choose('cat', 'fruits');
        const back = new Promise(resolve => addEventListener('popstate', resolve, { once: true }));
        history.back();
        await back;
        assert(select().value === 'vegetables', 'Back did not restore Vegetables');
        assert(new URLSearchParams(location.search).get('page') === '2', 'Back lost pagination');
        assert(document.getElementById('catalog-q').value === 'vegetable', 'Back lost search');
        assert(names().join() === 'Vegetable-02,Vegetable-01', 'Back restored the wrong results');
        const forward = new Promise(resolve => addEventListener('popstate', resolve, { once: true }));
        history.forward();
        await forward;
        assert(select().value === 'fruits' && names().join() === 'Melons', 'Forward did not restore Fruits');
    });
    await check('legacy Show filters do not hide subcategories', () => {
        reset('?cat=vegetables&browse=branches');
        assert(select().value === 'vegetables' && names().length === 12, 'Legacy filter still hides results');
    });
    await check('unknown category URLs restore All categories without a phantom option', () => {
        reset('?cat=missing');
        assert(!new URLSearchParams(location.search).has('cat'), 'Invalid category remains in URL');
        assert(select().value === '' && names().length === 4, 'Root view not restored');
        assert(!Array.from(select().options).some(option => option.value === 'missing'), 'Invalid option remains');
    });
    await check('search stays inside the selected category subtree', () => {
        reset('?cat=fruits&q=watermelon');
        assert(names().join() === 'Watermelon', 'Nested search did not find the category');
        reset('?cat=vegetables&q=watermelon');
        assert(names().length === 0, 'Search escaped the selected category');
    });
    await check('a category without subcategories opens its product listing', async () => {
        reset('?cat=fruits');
        const destination = new Promise(resolve => {
            const onNavigate = event => {
                const url = new URL(event.destination.url);
                if (!url.pathname.endsWith('/products.html')) return;
                event.preventDefault();
                navigation.removeEventListener('navigate', onNavigate);
                resolve({ url, type: event.navigationType });
            };
            navigation.addEventListener('navigate', onNavigate);
        });
        choose('cat', 'other-crops');
        const { url, type } = await destination;
        assert(url.pathname.endsWith('/products.html') && url.search === '?category=other-crops', 'Leaf category did not open products');
        assert(type === 'replace', 'Leaf navigation leaves a redirect loop in browser history');
    });
    document.body.replaceChildren();
    const report = document.createElement('pre');
    report.id = 'test-report';
    report.textContent = JSON.stringify(results);
    document.body.appendChild(report);
}

test('static storefront category navigation in Chrome', () => {
    const category = (name, slug, parentId = null, children = []) => ({ id: slug, slug, name, parentId, children });
    const categories = [
        category('Flowers', 'flowers', null, [category('Marigold', 'marigold', 'flowers')]),
        category('Fruits', 'fruits', null, [category('Melons', 'melons', 'fruits', [category('Watermelon', 'watermelon', 'melons')])]),
        category('Vegetables', 'vegetables', null, Array.from({ length: 14 }, (_, i) => {
            const number = String(i + 1).padStart(2, '0');
            return category('Vegetable-' + number, 'vegetable-' + number, 'vegetables');
        })),
        category('Other Crops', 'other-crops'),
    ];
    const directory = mkdtempSync(join(tmpdir(), 'orbi-categories-'));
    try {
        const scripts = ['catalog', 'catalog-browser', 'categories'].map(name =>
            `<script src="${pathToFileURL(resolve(__dirname, '../js', name + '.js')).href}"></script>`).join('');
        const fixture = join(directory, 'categories.html');
        writeFileSync(fixture, `<!doctype html><meta charset="utf-8">
            <div id="bg"></div><h1 class="product-heading"></h1><ul class="breadcrumb"></ul>
            <div id="back-btn-wrapper"></div><div id="catalog-controls"></div>
            <div id="catalog-results" class="products-inner-wrapper"></div><div id="catalog-pagination"></div>
            <script>history.replaceState({}, '', '?cat=vegetables');
            window.API_URL = 'https://api.example.test/api/'; window.APP_URL = 'https://api.example.test';
            window.fetchCount = 0; window.fetch = async () => { window.fetchCount++;
                return { ok: true, json: async () => ({ success: true, data: ${JSON.stringify(categories)} }) }; };</script>
            ${scripts}<script>window.addEventListener('load', ${checkCategories.toString()});</script>`);
        const output = execFileSync(process.env.CHROME_BIN || 'google-chrome', [
            '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
            '--disable-background-networking', '--user-data-dir=' + join(directory, 'profile'),
            '--virtual-time-budget=5000', '--dump-dom', pathToFileURL(fixture).href,
        ], { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
        const report = output.match(/<pre id="test-report">([^<]+)<\/pre>/);
        assert.ok(report, 'Browser checks did not finish: ' + output.slice(-1500));
        const results = JSON.parse(report[1]);
        assert.equal(results.length, 9);
        assert.deepEqual(results.filter(result => !result.passed), []);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
