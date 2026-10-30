// Unified storefront checks: node --test --test-isolation=none demo-orbis-seeds-v1-html/tests/*.test.cjs
// Requires Chrome; set CHROME_BIN if its executable is not google-chrome.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const imageFixtures = [
    { name: 'portrait', width: 800, height: 3200 },
    { name: 'landscape', width: 3200, height: 800 },
    { name: 'square', width: 900, height: 900 },
    { name: 'tiny', width: 24, height: 16 },
    { name: 'large', width: 8000, height: 6000 },
    { name: 'transparent', width: 100, height: 400 },
];

function writeImageFixtures(directory) {
    const uploads = join(directory, 'test-uploads');
    mkdirSync(uploads, { recursive: true });
    for (const { name, width, height } of imageFixtures) {
        writeFileSync(join(uploads, name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            ${name === 'transparent' ? '' : '<rect width="100%" height="100%" fill="#71c5dd"/>'}
            <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 3}" fill="#275037"/>
        </svg>`);
    }
}

async function checkCatalogue() {
    if (location.hash === '#preview') return;
    const results = [];
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const field = name => document.getElementById('catalog-' + name);
    const names = () => Array.from(document.querySelectorAll('.product-sec h3'), heading => heading.textContent);
    const until = async predicate => {
        for (let i = 0; i < 200; i++) {
            if (predicate()) return;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw new Error('Timed out waiting for catalogue');
    };
    const idle = () => until(() => document.getElementById('catalog-results').getAttribute('aria-busy') === 'false');
    const openCategories = (query = '') => {
        document.getElementById('catalog-filter-panel').open = true;
        if (field('category').getAttribute('aria-expanded') !== 'true') field('category').click();
        const input = field('category-search');
        input.value = query;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const choose = async (name, value) => {
        if (name === 'category') {
            openCategories(value);
            const option = Array.from(document.querySelectorAll('.catalog-category-option')).find(option => option.dataset.category === value);
            assert(option, 'Category is missing: ' + value);
            option.click();
        } else {
            field(name).value = value;
            field(name).dispatchEvent(new Event('change', { bubbles: true }));
        }
        await idle();
    };
    const reset = async (query = '') => {
        history.replaceState({}, '', location.pathname + query);
        window.dispatchEvent(new PopStateEvent('popstate'));
        await idle();
    };
    const check = async (name, callback) => {
        try { await callback(); results.push({ name, passed: true }); }
        catch (error) { results.push({ name, passed: false, error: error.message }); }
    };
    const initialFiltersOpen = document.getElementById('catalog-filter-panel').open;
    await idle();
    await until(() => field('category').textContent === 'Vegetables');
    await check('legacy parent category links show products in the same catalogue', () => {
        assert(new URLSearchParams(location.search).get('category') === 'vegetables', 'Legacy category was not normalized');
        assert(!new URLSearchParams(location.search).has('cat'), 'Legacy query remains');
        assert(field('category').dataset.value === 'vegetables', 'Parent category not selected');
        assert(names().length === 6 && names()[0] === 'Tomato 01', 'Category shows the wrong products');
        assert(document.getElementById('catalog-results-status').textContent.includes('of 14 products'), 'Product total is incorrect');
        assert(!document.querySelector('.product-inner'), 'Separate category cards are still shown');
        assert(document.querySelector('h1.product-heading').textContent === 'Our Products', 'Catalogue title is missing');
    });
    await check('control placement expresses search, filter and display priorities', () => {
        assert(document.querySelector('#catalog-search #catalog-q'), 'Search is missing from the primary area');
        assert(!document.getElementById('catalog-search-help'), 'Unwanted helper text remains below the search bar');
        assert(!document.querySelector('#catalog-active-filters, .catalog-filter-chip, .catalog-clear'), 'Duplicate applied filters or Clear all remain');
        assert(document.querySelector('.catalog-sidebar #catalog-category'), 'Category is not in the filter area');
        assert(!field('crop') && !field('group'), 'The two-level category controls are still present');
        assert(document.querySelector('#catalog-results-toolbar #catalog-sort'), 'Sort is not beside result count');
        assert(document.querySelector('.catalog-footer #catalog-limit'), 'Page size is not below the products');
        assert(document.querySelector('.enquiry-popup-wrapper form'), 'Enquiry form was lost while merging the pages');
    });
    const cards = () => Array.from(document.querySelectorAll('.catalog-category-card'));
    const previewCount = matchMedia('(max-width: 767px)').matches ? 2 : 4;
    const browse = async slug => {
        const link = cards().find(card => card.dataset.category === slug);
        assert(link, 'Visual category is missing: ' + slug);
        link.click(); await idle();
    };
    await check('image browsing shows immediate root categories alongside products', async () => {
        await reset('?limit=12&sort=name_desc');
        assert(cards().length === previewCount, 'Initial category preview ignores the screen size');
        if (previewCount < 4) document.querySelector('.catalog-browse-more').click();
        assert(cards().map(card => card.dataset.category).join() === 'vegetables,fruits,flowers,other-crops', 'Root cards include nested categories or omit collections');
        assert(cards()[0].querySelector('img').getAttribute('src') === 'images/products/cabbage/vijaya.jpg', 'Configured category image is not used');
        assert(cards()[2].querySelector('img').getAttribute('src') === 'images/orbi-seeds-logo.png', 'Unsafe category image was accepted');
        const destination = new URL(cards()[0].href);
        assert(destination.pathname === location.pathname && destination.searchParams.get('category') === 'vegetables'
            && destination.searchParams.get('limit') === '12' && destination.searchParams.get('sort') === 'name_desc', 'Category card is not a usable same-catalogue link');
        assert(document.querySelector('.catalog-browse-products') && names().length === 12, 'Visual browsing hides product results');
        cards()[3].scrollIntoView({ block: 'center' });
        await until(() => cards()[3].querySelector('img').getAttribute('src') === 'images/orbi-seeds-logo.png');
        assert(cards()[3].querySelector('.catalog-category-card-name').textContent === 'Other Crops', 'Broken image removed the category label');
        const before = location.href;
        document.querySelector('.catalog-browse-products').click();
        assert(document.activeElement === document.getElementById('catalog-list-title') && location.href === before, 'View products shortcut changed filters or lost focus');
    });
    await check('image cards drill through six levels and retain only the banner breadcrumb', async () => {
        await reset('?sort=name_desc&limit=12&page=2');
        const path = location.pathname;
        for (const slug of ['vegetables', 'tomato', 'cherry-tomato', 'greenhouse', 'determinate', 'early-selection']) {
            await browse(slug);
            const params = new URLSearchParams(location.search);
            assert(location.pathname === path && field('category').dataset.value === slug, 'Image browsing and selector are out of sync at ' + slug);
            assert(!params.has('page') && params.get('sort') === 'name_desc' && params.get('limit') === '12', 'Drilling did not reset the page and retain display preferences');
            assert(!document.querySelector('.catalog-browse-path'), 'Duplicate category breadcrumb remains');
        }
        assert(names().join() === 'Tomato 01' && !cards().length, 'Leaf category does not show its products');
        assert(document.activeElement === document.getElementById('catalog-list-title'), 'Leaf selection did not focus the products');
        assert(document.getElementById('catalog-category-browser').hidden, 'Leaf category keeps an empty Browsing section');
        const breadcrumb = document.querySelector('.inner-banner .breadcrumb');
        for (const name of ['Vegetables', 'Tomato', 'Cherry Tomato', 'Greenhouse', 'Determinate', 'Early Selection']) {
            assert(breadcrumb.textContent.includes(name), 'Banner breadcrumb lost category: ' + name);
        }
        assert(breadcrumb.querySelector('a[href="product.html?category=tomato"]'), 'Banner ancestor link is missing');
        await choose('category', 'tomato');
        assert(cards().map(card => card.dataset.category).join() === 'cherry-tomato', 'Returning to a branch did not restore category cards');
        await choose('category', '');
        assert(field('category').dataset.value === '' && cards().length === previewCount, 'All categories did not return to root collections');
    });
    await check('large branches keep a compact preview with an accessible show-all action', async () => {
        await reset('?category=vegetables');
        const more = document.querySelector('.catalog-browse-more');
        assert(cards().length === previewCount && more.textContent === 'Show all 7 categories', 'Large category branch is not bounded');
        more.focus(); more.click();
        assert(cards().length === 7 && more.getAttribute('aria-expanded') === 'true' && document.activeElement === more, 'Show all lost focus or omitted categories');
        assert(cards().some(card => card.dataset.category === 'cucumber') && !cards().some(card => card.dataset.category === 'cherry-tomato'), 'Browse cards flatten the hierarchy');
        assert(document.querySelector('.catalog-category-card[data-category="cucumber"] img').getAttribute('src') === 'images/variety-of-seeds/cucumber.png', 'Category image icon is not supported');
        assert(getComputedStyle(document.querySelector('.catalog-category-card[data-category="cucumber"] img')).objectFit === 'contain', 'Category icon is cropped like a photograph');
        more.click();
        assert(cards().length === previewCount && more.getAttribute('aria-expanded') === 'false', 'Show fewer did not restore the compact view');
        cards()[0].focus();
        updateCategoryBreadcrumbs('vegetables', 'Vegetables');
        await new Promise(resolve => setTimeout(resolve, 20));
        assert(document.activeElement === cards()[0], 'Identical cached category refresh lost card focus');
        for (const card of cards()) assert(card.tagName === 'A' && card.getBoundingClientRect().height >= 44, 'Category card is not accessible by keyboard/touch');
        assert(document.documentElement.scrollWidth <= innerWidth, 'Visual category cards overflow the page');
    });
    await check('search and direct category selection keep visual browsing in the correct context', async () => {
        await reset('?q=vegetables');
        const browser = document.getElementById('catalog-category-browser');
        assert(!browser.hidden && document.getElementById('catalog-category-browser-title').textContent === 'Searched categories', 'Search does not replace the browse section with searched categories');
        assert(document.querySelector('.catalog-results-column').contains(browser) && !document.querySelector('#catalog-search .catalog-category-card'), 'Searched categories are not in the browse section above products');
        assert(!document.querySelector('.catalog-category-matches'), 'Separate matching category suggestions remain below search');
        await browse('vegetables');
        assert(!document.getElementById('catalog-category-browser').hidden && cards()[0].dataset.category === 'tomato', 'Matching category did not resume visual browsing');
        assert(document.getElementById('catalog-category-browser-title').textContent === 'Explore Vegetables', 'Opening a searched category retains the search heading');
        await choose('category', 'greenhouse');
        assert(cards().map(card => card.dataset.category).join() === 'determinate', 'Searchable selector did not update visual category scope');
        await reset('?category=unknown');
        assert(document.getElementById('catalog-category-browser').hidden, 'Unknown category shows unrelated browse cards');
        await reset('?slug=tomato-01');
        assert(document.getElementById('catalog-category-browser').hidden, 'Direct product view shows unrelated root cards');
    });
    await check('browser back and forward restore the visual category branch', async () => {
        await reset();
        await browse('vegetables'); await browse('tomato');
        history.back();
        await until(() => field('category').dataset.value === 'vegetables'); await idle();
        assert(cards().some(card => card.dataset.category === 'cucumber'), 'Back did not restore parent category cards');
        history.forward();
        await until(() => field('category').dataset.value === 'tomato'); await idle();
        assert(cards().map(card => card.dataset.category).join() === 'cherry-tomato', 'Forward did not restore child category cards');
    });
    await check('nested category selection updates products without leaving the page', async () => {
        const path = location.pathname;
        await choose('category', 'cherry-tomato');
        assert(location.pathname === path, 'Crop opened a different page');
        assert(field('category').dataset.value === 'cherry-tomato', 'Nested category selection is out of sync');
        assert(document.getElementById('catalog-category-selection').textContent === 'Vegetables › Tomato › Cherry Tomato', 'Category hierarchy is missing');
        assert(names().join() === 'Tomato 01', 'Nested category did not filter products');
        assert(document.querySelector('.breadcrumb').textContent.includes('Tomato'), 'Breadcrumb is missing the parent crop');
        assert(document.getElementById('catalog-list-title').textContent === 'Products: Cherry Tomato', 'Product title is wrong');
        assert(window.categoryRequests === 1, 'Category tree was fetched again');
    });
    await check('category search reaches six levels and keeps the main query independent', async () => {
        await reset('?category=vegetables');
        const before = location.search;
        openCategories('GREENHOUSE early');
        const options = document.querySelectorAll('.catalog-category-option');
        assert(options.length === 1 && options[0].dataset.category === 'early-selection', 'Full-path category search failed');
        assert(options[0].querySelector('.catalog-category-path').textContent === 'Vegetables › Tomato › Cherry Tomato › Greenhouse › Determinate › Early Selection', 'Deep category path is incomplete');
        assert(location.search === before && field('q').value === '', 'Typing in category search changed the main search');
        options[0].click(); await idle();
        assert(field('category').dataset.value === 'early-selection' && names().join() === 'Tomato 01', 'Deep selection did not filter products');
        assert(document.querySelector('.breadcrumb').textContent.includes('Greenhouse'), 'Deep breadcrumb is incomplete');
    });
    await check('repeated category names show their distinct parent paths', async () => {
        await reset();
        openCategories('tomato');
        const options = Array.from(document.querySelectorAll('.catalog-category-option'));
        const first = options.find(option => option.dataset.category === 'tomato');
        const second = options.find(option => option.dataset.category === 'ornamental-tomato');
        assert(first && second, 'Repeated category names are not both reachable');
        assert(first.querySelector('.catalog-category-path').textContent === 'Vegetables › Tomato', 'Vegetable path is missing');
        assert(second.querySelector('.catalog-category-path').textContent === 'Flowers › Tomato', 'Flower path is missing');
        second.click(); await idle();
        assert(field('category').dataset.value === 'ornamental-tomato' && names().length === 0, 'Repeated-name selection opened the wrong branch');
    });
    await check('category picker supports keyboard selection, Escape and outside focus', async () => {
        await reset();
        openCategories('determinate');
        const input = field('category-search');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        assert(input.getAttribute('aria-activedescendant'), 'Active category is not announced');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await idle();
        assert(field('category').dataset.value === 'early-selection', 'Keyboard selection chose the wrong category');
        assert(document.activeElement === field('category') && field('category').getAttribute('aria-expanded') === 'false', 'Focus did not return to the selector');
        openCategories('missing');
        assert(!document.querySelector('.catalog-category-option') && document.querySelector('.catalog-category-message').textContent.includes('No categories'), 'Empty category search is unclear');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert(field('category').getAttribute('aria-expanded') === 'false' && field('category').dataset.value === 'early-selection', 'Escape changed the selected category');
        openCategories(); field('q').focus();
        assert(field('category').getAttribute('aria-expanded') === 'false', 'Picker remains open after focus leaves');
        openCategories();
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        assert(field('category').getAttribute('aria-expanded') === 'false', 'Outside pointer action leaves the picker open');
        openCategories('cucumber');
        document.querySelector('.catalog-category-dismiss').click();
        assert(field('category').getAttribute('aria-expanded') === 'false' && field('category').dataset.value === 'early-selection'
            && document.activeElement === field('category'), 'Close button changed the category or failed to restore focus');
    });
    await check('category refresh preserves a search inside the open selector', async () => {
        await reset('?category=vegetables');
        openCategories('early');
        updateCategoryBreadcrumbs('vegetables', 'Vegetables');
        await new Promise(resolve => setTimeout(resolve, 20));
        assert(field('category-search').value === 'early' && document.querySelectorAll('.catalog-category-option').length === 1, 'Refresh erased category search');
        field('category-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await check('main search finds parent categories and their descendant products', async () => {
        await reset('?q=vegetables');
        assert(names().length === 6 && document.getElementById('catalog-results-status').textContent.includes('of 14 products'), 'Parent category search misses nested products');
        const match = document.querySelector('.catalog-category-card[data-category="vegetables"]');
        assert(match && match.textContent.includes('Vegetables'), 'Matching parent category is missing');
        const bounds = match.getBoundingClientRect();
        assert(bounds.width <= 240 && bounds.height >= 44, 'Single matching category stretches across the search area or has a small touch target');
        assert(!match.querySelector('.catalog-category-card-context'), 'Root matching category repeats its name as a breadcrumb');
        assert(match.querySelector('img').getAttribute('src') === 'images/products/cabbage/vijaya.jpg', 'Searched category does not reuse its browse image');
        assert(match.tagName === 'A' && !new URL(match.href).searchParams.has('q'), 'Searched category does not provide a navigable category link');
        match.click(); await idle();
        assert(field('category').dataset.value === 'vegetables' && field('q').value === '' && names().length === 6, 'Matching category did not open in the same catalogue');
    });
    await check('large searched category collections use the browse preview and show-all action', async () => {
        await reset('?q=tomato');
        assert(cards().length === previewCount, 'Searched categories ignore the browse preview size');
        assert(cards().some(match => match.querySelector('.catalog-category-card-context').textContent === 'Vegetables'), 'Nested matching category omits its parent context');
        for (const match of cards()) {
            const bounds = match.getBoundingClientRect();
            assert(bounds.width <= 320 && bounds.height >= 44 && bounds.left >= 0 && bounds.right <= innerWidth, 'Matching categories stretch or overflow the viewport');
        }
        assert(document.documentElement.scrollWidth <= innerWidth, 'Matching category list causes horizontal overflow');
        const more = document.querySelector('.catalog-browse-more');
        assert(!more.hidden && more.textContent === 'Show all 8 categories', 'Remaining searched categories are unreachable');
        more.focus(); more.click();
        assert(cards().length === 8 && more.getAttribute('aria-expanded') === 'true' && document.activeElement === more, 'Show all searched categories omitted matches or lost focus');
        assert(new URLSearchParams(location.search).get('q') === 'tomato' && field('category').getAttribute('aria-expanded') === 'false', 'Expanding search cards changed filters or opened another selector');
        more.click();
        assert(cards().length === previewCount && more.getAttribute('aria-expanded') === 'false', 'Show fewer did not restore the search preview');
        more.click();
        await reset('?q=vegetables');
        await reset('?q=tomato');
        assert(cards().length === previewCount, 'A new search retained another search expansion');
        more.click();
        await reset('?category=vegetables&q=tomato');
        more.click();
        assert(cards().length === 7 && !cards().some(card => card.dataset.category === 'ornamental-tomato'), 'Searched categories escaped the selected category');
    });
    await check('main search finds intermediate categories, products and categories without products', async () => {
        await reset('?q=greenhouse');
        assert(names().join() === 'Tomato 01' && document.querySelector('.catalog-category-card[data-category="greenhouse"]'), 'Intermediate category search failed');
        await reset('?q=Tomato 14');
        assert(names().join() === 'Tomato 14' && document.getElementById('catalog-category-browser').hidden, 'Product-only search keeps unrelated category cards');
        await reset('?q=flowers');
        assert(names().length === 0 && document.querySelector('.catalog-category-card[data-category="flowers"]'), 'An empty category cannot be found');
        await reset('?category=fruits&q=tomato');
        assert(!cards().length && document.getElementById('catalog-category-browser').hidden && names().length === 0, 'Main search escaped its selected category');
    });
    await check('search matches crop names and stays within the selected category', async () => {
        await reset('?category=vegetables&q=tomato');
        assert(names().length === 6, 'Crop name did not find its products');
        await reset('?category=fruits&q=tomato');
        assert(names().length === 0 && document.querySelector('.catalog-empty-clear'), 'Search escaped its category or has no recovery action');
    });
    await check('main search waits for Search or form submission and retains active filters', async () => {
        await reset('?category=vegetables&page=2&sort=name_desc&limit=6');
        const before = { url: location.href, names: names().join(), requests: window.productRequests, history: history.length };
        field('q').value = 'TOM-01';
        field('q').dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 500));
        assert(location.href === before.url && history.length === before.history, 'Typing changed the search URL or history');
        assert(names().join() === before.names && window.productRequests === before.requests, 'Typing fetched or changed products');
        document.querySelector('.catalog-search-button').click();
        await idle();
        assert(names().join() === 'Tomato 01', 'SKU search did not work');
        assert(!new URLSearchParams(location.search).has('page'), 'Search did not reset pagination');
        assert(field('category').dataset.value === 'vegetables' && field('sort').value === 'name_desc', 'Search discarded filters or ordering');
        field('q').value = 'Melon';
        field('q').dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 500));
        assert(new URLSearchParams(location.search).get('q') === 'TOM-01' && names().join() === 'Tomato 01', 'Editing a submitted search applied it automatically');
        document.querySelector('.catalog-search-form').requestSubmit();
        await idle();
        assert(new URLSearchParams(location.search).get('q') === 'Melon' && names().length === 0, 'Form submission did not apply the search within its category');
    });
    await check('category refresh cannot discard a search being typed', async () => {
        await reset('?category=vegetables');
        field('q').value = 'TOM-01';
        field('q').dispatchEvent(new Event('input', { bubbles: true }));
        updateCategoryBreadcrumbs('vegetables', 'Vegetables');
        await new Promise(resolve => setTimeout(resolve, 500));
        assert(field('q').value === 'TOM-01' && !new URLSearchParams(location.search).has('q') && names().length === 6, 'Category refresh discarded or applied the search draft');
        document.querySelector('.catalog-search-button').click();
        await idle();
        assert(names().join() === 'Tomato 01', 'Category refresh discarded the search draft');
    });
    await check('sorting, page size, pagination and categories use the submitted query while retaining a draft', async () => {
        await reset('?category=vegetables&q=tomato');
        field('q').value = 'Melon';
        field('q').dispatchEvent(new Event('input', { bubbles: true }));
        await choose('sort', 'name_desc');
        assert(new URLSearchParams(location.search).get('q') === 'tomato' && names()[0] === 'Tomato 14' && field('q').value === 'Melon', 'Sorting applied or discarded the draft');
        await choose('limit', '12');
        assert(new URLSearchParams(location.search).get('q') === 'tomato' && names().length === 12 && field('q').value === 'Melon', 'Page size applied or discarded the draft');
        document.querySelector('[aria-label="Next page"]').click(); await idle();
        assert(new URLSearchParams(location.search).get('q') === 'tomato' && names().join() === 'Tomato 02,Tomato 01' && field('q').value === 'Melon', 'Pagination applied or discarded the draft');
        await choose('category', 'fruits');
        assert(new URLSearchParams(location.search).get('q') === 'tomato' && names().length === 0 && field('q').value === 'Melon', 'Category selection applied or discarded the draft');
        document.querySelector('.catalog-search-button').click(); await idle();
        assert(names().join() === 'Melon Prime' && new URLSearchParams(location.search).get('q') === 'Melon', 'Draft could not be submitted after changing display controls');
    });
    await check('clearing the main field waits for submission and All categories retains an unfinished draft', async () => {
        await reset('?q=Tomato 01');
        field('q').value = '';
        field('q').dispatchEvent(new Event('input', { bubbles: true }));
        const requests = window.productRequests;
        await new Promise(resolve => setTimeout(resolve, 500));
        assert(new URLSearchParams(location.search).get('q') === 'Tomato 01' && names().join() === 'Tomato 01' && window.productRequests === requests, 'Clearing the field ran a search automatically');
        document.querySelector('.catalog-search-button').click(); await idle();
        assert(!new URLSearchParams(location.search).has('q') && names().length === 6, 'Submitting an empty field did not clear the applied search');
        await choose('category', 'vegetables');
        field('q').value = 'Unfinished';
        field('q').dispatchEvent(new Event('input', { bubbles: true }));
        await choose('category', '');
        assert(field('q').value === 'Unfinished' && !new URLSearchParams(location.search).has('q') && field('category').dataset.value === '', 'All categories applied or discarded the search draft');
    });
    await check('changing categories preserves search and sort, and resets pagination', async () => {
        await reset('?category=vegetables&q=tomato&page=2&sort=name_desc&limit=6');
        const length = history.length;
        await choose('category', 'fruits');
        const params = new URLSearchParams(location.search);
        assert(params.get('q') === 'tomato' && params.get('sort') === 'name_desc' && params.get('limit') === '6', 'Category switch lost search or display preferences');
        assert(!params.has('page') && !params.has('slug') && !params.has('variant'), 'Stale page or linked product remains');
        assert(history.length === length + 1, 'Category switch added duplicate history entries');
        assert(field('category').textContent === 'Fruits', 'The previous nested selection remains');
    });
    await check('leaf categories work in place with the same category selector', async () => {
        await reset('?category=other-crops');
        assert(names().join() === 'Other Seed', 'Root leaf products did not load');
        assert(field('category').dataset.value === 'other-crops' && !field('crop'), 'Leaf category requires a second selector');
    });
    await check('search and category controls reset their own filters while preserving display preferences', async () => {
        await reset('?category=vegetables&q=tomato&sort=name_desc&limit=12');
        field('q').value = '';
        document.querySelector('.catalog-search-button').click(); await idle();
        assert(!new URLSearchParams(location.search).has('q') && field('category').dataset.value === 'vegetables', 'Clearing search removed the category');
        await reset('?category=vegetables&q=tomato&sort=name_desc&limit=12');
        await choose('category', '');
        assert(field('category').dataset.value === '' && field('q').value === 'tomato' && new URLSearchParams(location.search).get('q') === 'tomato', 'All categories removed the search');
        field('q').value = '';
        document.querySelector('.catalog-search-button').click(); await idle();
        const params = new URLSearchParams(location.search);
        assert(!params.has('q') && !params.has('category') && field('category').textContent === 'All categories', 'Filters did not reset through their controls');
        assert(field('sort').value === 'name_desc' && field('limit').value === '12', 'Resetting filters discarded display preferences');
        assert(!document.querySelector('#catalog-active-filters, .catalog-filter-chip, .catalog-clear'), 'Cleared filters leave a duplicate row');
    });
    await check('pagination and page size update visible products and totals', async () => {
        await reset('?category=vegetables');
        document.querySelector('[aria-label="Next page"]').click();
        await idle();
        assert(names()[0] === 'Tomato 07' && names().length === 6, 'Next page shows wrong products');
        assert(document.getElementById('catalog-results-status').textContent.includes('7–12 of 14'), 'Range is wrong');
        await choose('limit', '12');
        assert(names().length === 12 && !new URLSearchParams(location.search).has('page'), 'Page size did not reset page');
    });
    await check('browser Back and Forward restore search, category and page', async () => {
        await reset('?category=vegetables&q=tomato&page=2&sort=name_desc&limit=6');
        await choose('category', 'fruits');
        field('q').value = 'Unsubmitted';
        field('q').dispatchEvent(new Event('input', { bubbles: true }));
        const back = new Promise(resolve => addEventListener('popstate', resolve, { once: true }));
        history.back();
        await back; await idle();
        assert(field('category').dataset.value === 'vegetables' && field('q').value === 'tomato', 'Back lost search or filters');
        assert(new URLSearchParams(location.search).get('page') === '2' && names()[0] === 'Tomato 08', 'Back lost page or ordering');
        const forward = new Promise(resolve => addEventListener('popstate', resolve, { once: true }));
        history.forward();
        await forward; await idle();
        assert(field('category').dataset.value === 'fruits' && names().length === 0, 'Forward restored wrong results');
    });
    await check('saved links retain products outside the current page and select their variants', async () => {
        await reset('?category=vegetables&slug=tomato-14&variant=pack-14');
        const section = document.querySelector('[data-product-slug="tomato-14"]');
        assert(section && section.orbiVariant && section.orbiVariant.id === 'pack-14', 'Saved variant was not selected');
        assert(section.querySelector('.catalog-linked-label'), 'Linked product is not distinguished from paginated results');
        const line = OrbiCatalog.actionLine(section.querySelector('.add-enquiry-list'));
        assert(line.slug === 'tomato-14' && line.variantId === 'pack-14', 'Product action lost the variant');
        assert(OrbiCatalog.productUrl(line).startsWith('product.html?slug=tomato-14'), 'Wishlist/enquiry links use another catalogue');
        await choose('category', 'fruits');
        assert(!new URLSearchParams(location.search).has('slug') && !new URLSearchParams(location.search).has('variant'), 'New filters retain the saved product');
    });
    await check('product-only deep links remain usable and search returns to browsing', async () => {
        await reset('?slug=tomato-14&variant=pack-14');
        assert(names().join() === 'Tomato 14' && document.querySelector('.product-sec').orbiVariant.id === 'pack-14', 'Product-only link failed');
        field('q').value = 'Melon';
        document.querySelector('.catalog-search-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await idle();
        assert(names().join() === 'Melon Prime' && !new URLSearchParams(location.search).has('slug'), 'Search did not return to the catalogue');
    });
    await check('unknown categories, short searches and invalid pages have clear outcomes', async () => {
        await reset('?category=missing');
        assert(names().length === 0 && document.querySelector('.catalog-empty-clear'), 'Unknown category shows unrelated products');
        await reset('?q=x');
        assert(document.getElementById('catalog-results-status').textContent.includes('at least 2'), 'Short search has no explanation');
        await reset('?category=vegetables&page=999&limit=6');
        assert(names().length === 2 && new URLSearchParams(location.search).get('page') === '3', 'Invalid page was not corrected');
    });
    await check('failed product requests offer a working retry action', async () => {
        window.failNextProducts = true;
        await reset();
        assert(document.querySelector('.products-load-error [type="button"]'), 'No retry action');
        document.querySelector('.products-load-error button').click();
        await idle();
        assert(names().length === 6 && !document.querySelector('.products-load-error'), 'Retry did not recover');
    });
    await check('outdated requests cannot overwrite the newest filter selection', async () => {
        window.delayNextProducts = true;
        history.replaceState({}, '', '?category=vegetables');
        loadProductView();
        await choose('category', 'fruits');
        window.releaseProducts();
        await new Promise(resolve => setTimeout(resolve, 30));
        assert(names().join() === 'Melon Prime', 'Old response overwrote the active category');
    });
    await check('product galleries order primary images, deduplicate URLs and isolate thumbnail changes', async () => {
        await reset('?category=vegetables');
        const section = document.querySelector('[data-product-slug="tomato-01"]');
        const other = document.querySelector('[data-product-slug="tomato-02"] .product-gallery-main');
        const main = section.querySelector('.product-gallery-main');
        const thumbs = section.querySelectorAll('.product-gallery-thumbnail');
        assert(thumbs.length === 3, 'Gallery omitted images or retained invalid/duplicate images');
        assert(main.getAttribute('src').endsWith('/tomato.png') && main.alt === 'Tomato front view', 'Primary image did not come first');
        const originalUrl = location.href, otherImage = other.getAttribute('src');
        thumbs[1].click();
        assert(main.getAttribute('src').endsWith('/pepper.png') && main.alt === 'Tomato reverse view', 'Thumbnail did not display the ordered media image');
        assert(thumbs[1].getAttribute('aria-pressed') === 'true' && thumbs[0].getAttribute('aria-pressed') === 'false', 'Selected thumbnail is unclear');
        section.querySelector('.product-gallery-prev').click();
        section.querySelector('.product-gallery-prev').click();
        assert(main.getAttribute('src').endsWith('/cucumber.png') && section.querySelector('.product-gallery-count').textContent === 'Image 3 of 3', 'Previous navigation did not wrap');
        section.querySelector('.product-gallery-next').click();
        assert(main.getAttribute('src').endsWith('/tomato.png'), 'Next navigation did not wrap');
        assert(other.getAttribute('src') === otherImage && location.href === originalUrl && !section.orbiVariant, 'Browsing images changed another product, URL or variant');
    });
    await check('gallery thumbnails support keyboard navigation and touch swipes', async () => {
        await reset('?slug=tomato-01');
        const section = document.querySelector('.product-sec');
        const thumbs = section.querySelectorAll('.product-gallery-thumbnail');
        thumbs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        assert(thumbs[2].getAttribute('aria-pressed') === 'true' && document.activeElement === thumbs[2], 'End did not select/focus the last image');
        thumbs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        assert(thumbs[0].getAttribute('aria-pressed') === 'true' && document.activeElement === thumbs[0], 'Keyboard navigation did not wrap');
        const button = section.querySelector('.product-gallery-open');
        button.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: 200, clientY: 80 }));
        button.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', clientX: 70, clientY: 82 }));
        button.click();
        assert(thumbs[1].getAttribute('aria-pressed') === 'true' && !document.querySelector('.product-image-dialog[open]'), 'Swipe did not change the image or opened a dialog accidentally');
        button.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 0 }));
        button.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', clientX: 108, clientY: 110 }));
        assert(thumbs[1].getAttribute('aria-pressed') === 'true', 'Vertical scrolling changed the image');
    });
    await check('enlarged galleries navigate images, close with Escape and restore focus', async () => {
        await reset('?slug=tomato-01');
        const section = document.querySelector('.product-sec');
        const open = section.querySelector('.product-gallery-open');
        const overflow = document.body.style.overflow;
        open.click();
        const dialog = document.querySelector('.product-image-dialog');
        assert(dialog.open && document.body.style.overflow === 'hidden', 'Larger viewer did not open or lock background scrolling');
        assert(dialog.querySelector('h2').textContent === 'Tomato 01' && dialog.contains(document.activeElement), 'Viewer title or focus is missing');
        dialog.querySelector('.product-gallery-next').click();
        assert(dialog.querySelector('img').getAttribute('src').endsWith('/pepper.png') && section.querySelector('.product-gallery-main').getAttribute('src').endsWith('/pepper.png'), 'Viewer and product gallery diverged');
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        assert(dialog.querySelector('img').getAttribute('src').endsWith('/tomato.png'), 'Viewer keyboard navigation failed');
        dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
        assert(!dialog.open && document.activeElement === open && document.body.style.overflow === overflow, 'Escape did not close the viewer and restore focus/scrolling');
        open.click(); dialog.querySelector('.product-image-dialog-close').click();
        assert(!dialog.open && document.body.style.overflow === overflow, 'Close button did not restore scrolling');
        open.click();
        await reset('?category=fruits');
        assert(!dialog.open && document.body.style.overflow === overflow, 'Catalogue navigation left an active viewer or scroll lock');
        assert(document.querySelectorAll('.product-image-dialog').length === 1, 'Viewer dialogs were duplicated on rerender');
    });
    await check('variant galleries show their own images first and retain shared photos', async () => {
        await reset('?category=vegetables&slug=tomato-14&variant=pack-14');
        const section = document.querySelector('[data-product-slug="tomato-14"]');
        const main = section.querySelector('.product-gallery-main');
        const variant = section.querySelector('.variant-select');
        assert(section.querySelectorAll('.product-gallery-thumbnail').length === 3 && main.getAttribute('src').endsWith('/okra.png'), 'Saved variant gallery did not prioritize its images or deduplicate shared media');
        assert(main.alt === '100g packet front', 'Variant image alt text was lost');
        section.querySelectorAll('.product-gallery-thumbnail')[1].click();
        assert(main.getAttribute('src').endsWith('/cabbage.png'), 'Second variant photo is unavailable');
        variant.value = 'pack-14-500g'; variant.dispatchEvent(new Event('change', { bubbles: true }));
        assert(main.getAttribute('src').endsWith('/cauliflower.png') && section.querySelectorAll('.product-gallery-thumbnail').length === 2, 'Variant media fallback or gallery reset failed');
        const sources = Array.from(section.querySelectorAll('.product-gallery-thumbnail img'), image => image.getAttribute('src'));
        assert(!sources.some(src => src.includes('okra') || src.includes('cabbage')), 'Images from another variant leaked into the gallery');
        section.querySelectorAll('.product-gallery-thumbnail')[1].click();
        const line = OrbiCatalog.actionLine(section.querySelector('.add-enquiry-list'));
        assert(line.variantId === 'pack-14-500g' && line.image.endsWith('/cauliflower.png'), 'Viewing a shared photo changed the variant or enquiry image');
        section.querySelector('.reset-product-options').click();
        assert(!section.orbiVariant && main.getAttribute('src').endsWith('/tomato.png') && section.querySelector('.product-gallery-thumbnails').hidden, 'Clear selection did not restore the product gallery');
        variant.value = 'pack-14-plain'; variant.dispatchEvent(new Event('change', { bubbles: true }));
        assert(section.orbiVariant.id === 'pack-14-plain' && main.getAttribute('src').endsWith('/tomato.png'), 'Variant without media did not use product images');
    });
    await check('single-image products hide redundant gallery controls', async () => {
        await reset('?slug=tomato-02');
        const section = document.querySelector('.product-sec');
        assert(section.querySelector('.product-gallery-controls').hidden && section.querySelector('.product-gallery-thumbnails').hidden, 'Single image has redundant controls');
        assert(!section.querySelector('.product-gallery-open').disabled, 'Single image cannot be enlarged');
        section.querySelector('.product-gallery-open').click();
        const dialog = document.querySelector('.product-image-dialog');
        assert(dialog.open && dialog.querySelector('.product-image-dialog-nav').hidden, 'Single-image viewer has redundant navigation');
        OrbiCatalog.closeGallery();
    });
    await check('missing, unsafe and malformed images use a stable placeholder', async () => {
        await reset('?category=other-crops');
        const section = document.querySelector('.product-sec');
        assert(section.querySelector('.product-gallery-main').getAttribute('src') === 'images/orbi-seeds-logo.png', 'Missing product image has no placeholder');
        assert(section.querySelector('.product-gallery-open').disabled && section.querySelector('.product-gallery-message').textContent === 'Image unavailable', 'Missing image offers a misleading enlargement action');
        const unsafe = OrbiCatalog.galleryImages({ name: 'Unsafe', images: [null, { url: 'javascript:alert(1)' }, { url: 'https://[' }, { url: '//unsafe.example/image' }] });
        assert(unsafe.length === 1 && unsafe[0].unavailable, 'Invalid image URLs were not rejected');
    });
    await check('failed image loads retain working navigation and recover on the next image', async () => {
        await reset('?slug=tomato-03');
        const section = document.querySelector('.product-sec');
        section.scrollIntoView({ block: 'start' });
        const main = section.querySelector('.product-gallery-main');
        await until(() => section.querySelector('.product-gallery-message').textContent === 'Image unavailable');
        assert(main.getAttribute('src') === 'images/orbi-seeds-logo.png' && section.querySelector('.product-gallery-open').disabled, 'Broken main image did not fall back');
        section.querySelector('.product-gallery-next').click();
        assert(main.getAttribute('src').endsWith('/tomato.png') && !section.querySelector('.product-gallery-open').disabled, 'Gallery could not recover to a valid image');
        section.querySelector('.product-gallery-prev').click();
        assert(main.getAttribute('src') === 'images/orbi-seeds-logo.png', 'Returning to a failed image retried it indefinitely');
    });
    await check('large galleries and enlarged images fit mobile and desktop viewports', async () => {
        await reset('?slug=tomato-04');
        const section = document.querySelector('.product-sec');
        const strip = section.querySelector('.product-gallery-thumbnails');
        assert(strip.children.length === 8 && strip.scrollWidth > strip.clientWidth, 'Large thumbnail strip does not scroll');
        assert(document.documentElement.scrollWidth <= innerWidth, 'Gallery makes the page overflow horizontally');
        for (const control of section.querySelectorAll('.product-gallery-thumbnail, .product-gallery-prev, .product-gallery-next')) {
            assert(control.getBoundingClientRect().width >= 44 && control.getBoundingClientRect().height >= 44, 'Image control touch target is too small');
        }
        strip.lastElementChild.click();
        assert(section.querySelector('.product-gallery-count').textContent === 'Image 8 of 8', 'Last image is unreachable');
        section.querySelector('.product-gallery-open').click();
        const dialog = document.querySelector('.product-image-dialog');
        const rect = dialog.getBoundingClientRect();
        assert(rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, 'Enlarged viewer extends outside the viewport');
        assert(getComputedStyle(dialog.querySelector('img')).objectFit === 'contain', 'Enlarged image is cropped');
        OrbiCatalog.closeGallery();
    });
    await check('mixed upload dimensions keep product frames and thumbnails stable and enlarged images complete', async () => {
        await reset('?slug=tomato-02');
        const section = document.querySelector('.product-sec');
        const gallery = OrbiCatalog.mountGallery(section, { name: 'Upload sizes', images: window.imageFixtures.map(item => ({ url: 'test-uploads/' + item.name + '.svg' })) });
        gallery.update(null);
        section.scrollIntoView({ block: 'start' });
        const button = section.querySelector('.product-gallery-open');
        const main = section.querySelector('.product-gallery-main');
        const initial = button.getBoundingClientRect();
        assert(Math.abs(initial.width - initial.height) <= 1, 'Product preview frame is not square before the upload loads');
        try {
            for (let index = 0; index < window.imageFixtures.length; index++) {
                const source = window.imageFixtures[index];
                gallery.select(index);
                await main.decode();
                const frame = button.getBoundingClientRect(), image = main.getBoundingClientRect();
                assert(main.naturalWidth === source.width && main.naturalHeight === source.height, 'Upload fixture did not load at its native dimensions: ' + source.name);
                assert(Math.abs(frame.width - initial.width) <= 1 && Math.abs(frame.height - initial.height) <= 1, 'Upload resized the product frame: ' + source.name);
                assert(image.width <= frame.width && image.height <= frame.height && image.left >= frame.left && image.top >= frame.top, 'Upload escaped its product frame: ' + source.name);
                assert(getComputedStyle(main).objectFit === 'cover', 'Product preview leaves empty bands for ' + source.name);
                const thumb = section.querySelectorAll('.product-gallery-thumbnail')[index];
                const thumbImage = thumb.querySelector('img');
                thumbImage.loading = 'eager'; await thumbImage.decode();
                assert(thumb.getBoundingClientRect().width === 48 && thumb.getBoundingClientRect().height === 48, 'Upload resized a thumbnail');
                assert(getComputedStyle(thumbImage).objectFit === 'cover', 'Thumbnail does not fill its frame');
                button.click();
                const dialog = document.querySelector('.product-image-dialog');
                const enlarged = dialog.querySelector('img');
                await enlarged.decode();
                const stage = dialog.querySelector('.product-image-dialog-stage').getBoundingClientRect();
                const full = enlarged.getBoundingClientRect();
                assert(getComputedStyle(enlarged).objectFit === 'contain', 'Enlarged upload is cropped');
                assert(full.left >= stage.left - 1 && full.right <= stage.right + 1 && full.top >= stage.top - 1 && full.bottom <= stage.bottom + 1, 'Enlarged upload overflows the viewer: ' + source.name);
                OrbiCatalog.closeGallery();
                assert(document.documentElement.scrollWidth <= innerWidth, 'Upload makes the page overflow horizontally');
            }
        } finally { OrbiCatalog.closeGallery(); }
    });
    await check('mixed category upload dimensions fill consistent frames and preserve logo fallback', async () => {
        await reset();
        const card = document.querySelector('.catalog-category-card');
        const image = card.querySelector('img');
        card.scrollIntoView({ block: 'center' });
        await image.decode();
        const initial = image.getBoundingClientRect(), initialCard = card.getBoundingClientRect();
        for (const source of window.imageFixtures) {
            image.src = 'test-uploads/' + source.name + '.svg';
            await image.decode();
            const frame = image.getBoundingClientRect();
            assert(image.naturalWidth === source.width && image.naturalHeight === source.height, 'Category upload did not load');
            assert(Math.abs(frame.width - initial.width) <= 1 && Math.abs(frame.height - initial.height) <= 1
                && Math.abs(card.getBoundingClientRect().height - initialCard.height) <= 1, 'Category upload changed the card size: ' + source.name);
            assert(getComputedStyle(image).objectFit === 'cover', 'Category preview leaves empty bands for ' + source.name);
            assert(document.documentElement.scrollWidth <= innerWidth, 'Category upload makes the page overflow');
        }
        image.dispatchEvent(new Event('error')); await image.decode();
        assert(image.classList.contains('is-placeholder') && getComputedStyle(image).objectFit === 'contain', 'Logo fallback is cropped');
    });
    await check('desktop and mobile retain readable controls without horizontal overflow', async () => {
        await reset('?category=vegetables');
        const mobile = matchMedia('(max-width: 767px)').matches;
        assert(initialFiltersOpen === !mobile, 'Responsive filter disclosure is incorrect');
        if (mobile) document.getElementById('catalog-filter-panel').open = true;
        assert(innerWidth === Number(document.documentElement.dataset.testWidth), 'Unexpected viewport width: ' + innerWidth);
        openCategories('tomato');
        assert(document.documentElement.scrollWidth <= innerWidth, 'Open category picker overflows horizontally');
        const popup = document.getElementById('catalog-category-popover').getBoundingClientRect();
        assert(popup.left >= 0 && popup.right <= innerWidth && popup.top >= 0 && popup.bottom <= innerHeight, 'Category picker extends beyond the viewport: ' + JSON.stringify({ popup: popup.toJSON(), trigger: field('category').getBoundingClientRect().toJSON(), scrollY }));
        const product = document.querySelector('.products-right').getBoundingClientRect();
        const overlap = { left: Math.max(popup.left, product.left), right: Math.min(popup.right, product.right),
            top: Math.max(popup.top, product.top), bottom: Math.min(popup.bottom, product.bottom) };
        if (overlap.right > overlap.left && overlap.bottom > overlap.top) {
            const top = document.elementFromPoint((overlap.left + overlap.right) / 2, (overlap.top + overlap.bottom) / 2);
            assert(document.getElementById('catalog-category-popover').contains(top), 'Product details cover the category picker');
        }
        field('category-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert(document.documentElement.scrollWidth <= innerWidth, 'Page overflows horizontally');
        for (const name of ['q', 'category', 'sort', 'limit']) {
            assert(field(name).getBoundingClientRect().height >= 44, name + ' touch target is too small');
            assert(document.querySelector('label[for="catalog-' + name + '"]'), name + ' has no label');
        }
        const longQuery = 'Verylongproductsearch'.repeat(5).slice(0, 100);
        await reset('?category=early-selection&q=' + encodeURIComponent(longQuery));
        assert(field('q').value === longQuery, 'Search field lost the full query');
        assert(field('category').dataset.value === 'early-selection' && field('category').textContent === 'Early Selection', 'Category control lost the nested selection');
        assert(!document.querySelector('#catalog-active-filters, .catalog-filter-chip, .catalog-clear'), 'Long selections restore the duplicate applied filters row');
        for (const control of [field('q'), field('category'), document.querySelector('.catalog-search-button')]) {
            const bounds = control.getBoundingClientRect();
            assert(bounds.height >= 44 && bounds.width >= 44 && bounds.left >= 0 && bounds.right <= innerWidth, 'Search or category control is too small or overflows');
        }
        assert(document.documentElement.scrollWidth <= innerWidth, 'Long search or category selection overflows horizontally');
    });
    document.body.replaceChildren();
    const report = document.createElement('pre');
    report.id = 'test-report';
    report.textContent = JSON.stringify(results);
    document.body.appendChild(report);
}

function fixtures() {
    const category = (name, slug, children = []) => ({ id: slug, slug, name, children });
    const early = category('Early Selection', 'early-selection');
    const cherry = category('Cherry Tomato', 'cherry-tomato', [category('Greenhouse', 'greenhouse', [category('Determinate', 'determinate', [early])])]);
    const tomato = category('Tomato', 'tomato', [cherry]);
    const fruits = category('Fruits', 'fruits', [category('Melon', 'melon')]);
    const categories = [category('Vegetables', 'vegetables', [tomato, category('Cucumber', 'cucumber'), ...Array.from({ length: 5 }, (_, i) => category('Tomato Group ' + i, 'tomato-group-' + i))]), fruits,
        category('Flowers', 'flowers', [category('Tomato', 'ornamental-tomato')]), category('Other Crops', 'other-crops')];
    categories[0].image = 'images/products/cabbage/vijaya.jpg';
    tomato.image = cherry.image = 'images/tomato-research.png';
    categories[0].children[1].icon = 'images/variety-of-seeds/cucumber.png';
    fruits.image = 'images/products/watermelon/w3n-5.jpg';
    categories[2].image = 'javascript:alert(1)';
    categories[3].image = 'images/missing-category-photo.png';
    const products = Array.from({ length: 14 }, (_, index) => {
        const number = String(index + 1).padStart(2, '0');
        return { id: 'p-' + number, name: 'Tomato ' + number, slug: 'tomato-' + number, sku: 'TOM-' + number,
            type: index === 13 ? 'variable' : 'simple', quantity: 10,
            categories: [index === 0 ? early : tomato],
            description: 'A vigorous seed variety selected for reliable growth and uniform fruit.',
            attributes: [{ customName: 'Maturity', customValue: '60–65 days' }, { customName: 'Fruit shape', customValue: 'Round' }],
            images: [{ url: 'images/variety-of-seeds/tomato.png', isPrimary: true }],
            variants: index === 13 ? [{ id: 'pack-14', sku: 'TOM-14-100G', isActive: true, stockQty: 10 }] : [] };
    });
    products[0].images = [
        { url: 'images/variety-of-seeds/cucumber.png', sortOrder: 2, alt: 'Tomato crop detail' },
        { url: 'images/variety-of-seeds/tomato.png', sortOrder: 9, isPrimary: true, alt: 'Tomato front view' },
        { media: { url: 'images/variety-of-seeds/pepper.png' }, sortOrder: 1, alt: 'Tomato reverse view' },
        { url: './images/variety-of-seeds/tomato.png', sortOrder: 0 },
        { url: 'javascript:alert(1)' }, { url: 'https://[' }, null,
    ];
    products[2].images = [{ url: 'images/missing-product-photo.png', isPrimary: true }, { url: 'images/variety-of-seeds/tomato.png' }];
    products[3].images = ['tomato', 'cucumber', 'pepper', 'okra', 'cabbage', 'cauliflower', 'pumpkin', 'watermelon'].map((name, sortOrder) => ({ url: 'images/variety-of-seeds/' + name + '.png', sortOrder }));
    products[13].variants = [
        { id: 'pack-14', sku: 'TOM-14-100G', isActive: true, stockQty: 10,
            images: [{ url: 'images/variety-of-seeds/okra.png', isPrimary: true, sortOrder: 3, alt: '100g packet front' },
                { url: 'images/variety-of-seeds/cabbage.png', sortOrder: 1 }, { url: './images/variety-of-seeds/tomato.png', sortOrder: 2 }],
            media: { url: 'images/variety-of-seeds/okra.png' } },
        { id: 'pack-14-500g', sku: 'TOM-14-500G', isActive: true, stockQty: 10, media: { url: 'images/variety-of-seeds/cauliflower.png' } },
        { id: 'pack-14-plain', sku: 'TOM-14-PLAIN', isActive: true, stockQty: 10 },
    ];
    products.push({ id: 'melon', name: 'Melon Prime', slug: 'melon-prime', categories: [fruits.children[0]], images: [{ url: 'images/variety-of-seeds/watermelon.png' }] },
        { id: 'other', name: 'Other Seed', slug: 'other-seed', categories: [categories[3]] });
    return { categories, products, imageFixtures };
}

function bootstrap(data) {
    history.replaceState({}, '', '?cat=vegetables' + location.hash);
    window.API_URL = 'https://api.example.test/api/'; window.APP_URL = 'https://api.example.test';
    window.categoryRequests = 0;
    window.productRequests = 0;
    window.imageFixtures = data.imageFixtures;
    window.$ = node => ({ on() {}, data(key, value) {
        node._data = node._data || {};
        if (arguments.length === 2) node._data[key] = value;
        return node._data[key];
    } });
    const descendant = (items, slug) => {
        for (const item of items) {
            if (item.slug === slug) return [item.slug, ...(function all(children) { return children.flatMap(child => [child.slug, ...all(child.children || [])]); })(item.children || [])];
            const found = descendant(item.children || [], slug);
            if (found) return found;
        }
        return null;
    };
    const paths = new Map();
    (function collect(items, parents = []) {
        for (const item of items) { const path = parents.concat(item); paths.set(item.slug, path); collect(item.children || [], path); }
    })(data.categories);
    window.fetch = async raw => {
        const url = new URL(raw);
        if (url.pathname.endsWith('/categories')) {
            window.categoryRequests++;
            return { ok: true, json: async () => ({ success: true, data: data.categories }) };
        }
        if (url.pathname.endsWith('/products')) {
            window.productRequests++;
            if (window.failNextProducts) { window.failNextProducts = false; throw new Error('Temporary failure'); }
            const q = (url.searchParams.get('search') || '').toLowerCase();
            const scope = url.searchParams.get('category');
            const ids = scope ? descendant(data.categories, scope) || [] : null;
            let items = data.products.filter(product => (!ids || product.categories.some(category => ids.includes(category.slug)))
                && (!q || [product.name, product.sku, product.description, ...product.categories.flatMap(category => (paths.get(category.slug) || [category]).flatMap(item => [item.name, item.slug]))].join(' ').toLowerCase().includes(q)));
            items.sort((a, b) => a.name.localeCompare(b.name));
            if (url.searchParams.get('sortOrder') === 'DESC' || url.searchParams.get('sort') === 'newest') items.reverse();
            const limit = Number(url.searchParams.get('limit')) || 6;
            const page = Number(url.searchParams.get('page')) || 1;
            const response = { ok: true, json: async () => ({ success: true, data: items.slice((page - 1) * limit, page * limit),
                meta: { total: items.length, totalPages: Math.ceil(items.length / limit), page, limit } }) };
            if (window.delayNextProducts) {
                window.delayNextProducts = false;
                return new Promise(resolve => { window.releaseProducts = () => resolve(response); });
            }
            return response;
        }
        const slug = decodeURIComponent(url.pathname.split('/').pop());
        const product = data.products.find(product => product.slug === slug);
        return { ok: !!product, json: async () => ({ success: !!product, data: product }) };
    };
}

function fixtureHtml() {
    const root = resolve(__dirname, '..');
    let html = readFileSync(join(root, 'product.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    // Tests use the real page, styles and scripts; external font/carousel downloads are unnecessary.
    html = html.replace(/<link\b[^>]*(?:https:|preconnect)[^>]*>/gi, '');
    html = html.replace(/(src|href)="((?:images|css)\/[^"]+)"/g, (_, attr, file) => attr + '="' + pathToFileURL(join(root, file)).href + '"');
    const scripts = ['catalog', 'catalog-browser', 'products'].map(name => `<script src="${pathToFileURL(join(root, 'js', name + '.js')).href}"></script>`).join('');
    return html.replace('</body>', `<script>(${bootstrap.toString()})(${JSON.stringify(fixtures())});</script>${scripts}
        <script>window.addEventListener('load', ${checkCatalogue.toString()});</script></body>`);
}

test('old products links preserve query, category, product, variant and fragment', () => {
    const source = readFileSync(resolve(__dirname, '../js/catalog-redirect.js'), 'utf8');
    for (const suffix of ['?cat=vegetables&q=tomato&page=2#results', '?category=tomato&slug=tomato-14&variant=pack-14']) {
        let destination;
        const location = new URL('https://store.example/shop/products.html' + suffix);
        location.replace = url => { destination = url; };
        vm.runInNewContext(source, { URL, window: { location } });
        assert.equal(destination, 'https://store.example/shop/product.html' + suffix);
    }
});

// Set the viewport through Chrome's test protocol: recent Chrome versions clamp
// normal browser windows to 500px even when --window-size requests a phone width.
async function runChrome(fixture, directory, width, previewDirectory) {
    const browser = spawn(process.env.CHROME_BIN || 'google-chrome', [
        '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
        '--disable-background-networking', '--no-startup-window', '--remote-debugging-pipe',
        '--user-data-dir=' + join(directory, 'profile'),
    ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
    const exited = new Promise(resolve => browser.once('exit', resolve));
    const pending = new Map();
    let sequence = 0, buffer = '', errors = '', load;
    const timeout = setTimeout(() => {
        pending.forEach(({ reject }) => reject(new Error('Chrome timed out: ' + errors.slice(-1500))));
        browser.kill();
    }, 25000);
    browser.stderr.on('data', chunk => { errors += chunk; });
    browser.on('error', error => pending.forEach(({ reject }) => reject(error)));
    browser.on('exit', () => pending.forEach(({ reject }) => reject(new Error('Chrome exited: ' + errors.slice(-1500)))));
    browser.stdio[4].on('data', chunk => {
        buffer += chunk.toString();
        let end;
        while ((end = buffer.indexOf('\0')) !== -1) {
            const message = JSON.parse(buffer.slice(0, end));
            buffer = buffer.slice(end + 1);
            if (pending.has(message.id)) {
                const task = pending.get(message.id);
                pending.delete(message.id);
                if (message.error) task.reject(new Error(JSON.stringify(message.error)));
                else task.resolve(message.result);
            } else if (message.method === 'Page.loadEventFired' && load) { load(); load = null; }
        }
    });
    function send(method, params = {}, sessionId) {
        return new Promise((resolve, reject) => {
            const id = ++sequence;
            pending.set(id, { resolve, reject });
            browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
        });
    }
    try {
        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
        const command = (method, params) => send(method, params, sessionId);
        await command('Page.enable');
        await command('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
        const loaded = new Promise(resolve => { load = resolve; });
        await command('Page.navigate', { url: pathToFileURL(fixture).href });
        await loaded;
        const { result, exceptionDetails } = await command('Runtime.evaluate', {
            expression: `new Promise(resolve => { const poll = setInterval(() => {
                const report = document.getElementById('test-report');
                if (report) { clearInterval(poll); resolve(report.textContent); }
            }, 20); })`, awaitPromise: true, returnByValue: true,
        });
        if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
        const results = JSON.parse(result.value);
        const ready = new Promise(resolve => { load = resolve; });
        await command('Page.navigate', { url: pathToFileURL(fixture).href + '#preview' });
        await ready;
        await command('Runtime.evaluate', { expression: `new Promise(resolve => { const poll = setInterval(() => {
            if (document.querySelector('.product-sec')) { clearInterval(poll); resolve(); }
        }, 20); })`, awaitPromise: true });
        // Chrome autofill removes background images with a user-agent !important rule.
        // Force that real browser state rather than imitating it with an input event.
        await command('DOM.enable');
        await command('CSS.enable');
        const { root } = await command('DOM.getDocument');
        const { nodeId } = await command('DOM.querySelector', { nodeId: root.nodeId, selector: '#catalog-q' });
        const originalSearch = await command('Runtime.evaluate', { expression: `(() => {
            const input = document.getElementById('catalog-q');
            const previous = input.value; input.value = 'Vegetables';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return previous;
        })()`, returnByValue: true });
        await command('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['autofill'] });
        const autofill = await command('Runtime.evaluate', { expression: `(() => {
            const input = document.getElementById('catalog-q');
            const icon = document.querySelector('.catalog-search-icon');
            const bounds = icon && icon.getBoundingClientRect();
            const field = input.getBoundingClientRect();
            const style = icon && getComputedStyle(icon);
            return input.matches(':autofill') && input.value === 'Vegetables' && icon
                && style.visibility === 'visible' && style.opacity !== '0' && style.stroke !== 'none'
                && bounds.width >= 18 && bounds.height >= 18 && bounds.left >= field.left
                && bounds.right <= field.left + parseFloat(getComputedStyle(input).paddingLeft)
                && bounds.top >= field.top && bounds.bottom <= field.bottom;
        })()`, returnByValue: true });
        results.push({ name: 'browser autofill keeps the search icon visible without overlapping text', passed: autofill.result.value === true });
        if (previewDirectory) {
            await command('Runtime.evaluate', { expression: `document.getElementById('catalog-search').scrollIntoView({ block: 'start' });` });
            const autofillScreenshot = await command('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(previewDirectory, 'catalogue-autofill-' + width + '.png'), Buffer.from(autofillScreenshot.data, 'base64'));
        }
        await command('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
        await command('Runtime.evaluate', { expression: `document.getElementById('catalog-q').value = ${JSON.stringify(originalSearch.result.value)};` });
        if (previewDirectory) {
            const screenshot = await command('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(previewDirectory, 'catalogue-' + width + '.png'), Buffer.from(screenshot.data, 'base64'));
            await command('Runtime.evaluate', { expression: 'document.getElementById("catalog-q").focus({ preventScroll: true });' });
            await command('Runtime.evaluate', { expression: 'new Promise(resolve => setTimeout(resolve, 180))', awaitPromise: true });
            const focusedSearch = await command('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(previewDirectory, 'catalogue-search-focused-' + width + '.png'), Buffer.from(focusedSearch.data, 'base64'));
            await command('Runtime.evaluate', { expression: `document.getElementById('catalog-filter-panel').open = true;
                document.getElementById('catalog-category').click();` });
            await command('Runtime.evaluate', { expression: 'new Promise(resolve => setTimeout(resolve, 180))', awaitPromise: true });
            const categoryBrowse = await command('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(previewDirectory, 'catalogue-picker-' + width + '.png'), Buffer.from(categoryBrowse.data, 'base64'));
            await command('Runtime.evaluate', { expression: 'document.querySelector(".catalog-category-dismiss").click();' });
            for (const [label, query] of [
                ['root', ''], ['leaf', '?category=early-selection'],
                ['filters', '?category=vegetables&q=Tomato%2001'],
                ['long-filters', '?category=early-selection&q=' + 'Verylongproductsearch'.repeat(5).slice(0, 100)],
                ['matching-single', '?q=vegetables'], ['matching-many', '?q=tomato'],
            ]) {
                await command('Runtime.evaluate', { expression: `history.replaceState({}, '', location.pathname + ${JSON.stringify(query)});
                    loadProductView(); new Promise(resolve => { const poll = setInterval(() => {
                        if (document.getElementById('catalog-results').getAttribute('aria-busy') === 'false') {
                            clearInterval(poll);
                            const browser = document.getElementById('catalog-category-browser');
                            const target = /filters|matching/.test(${JSON.stringify(label)}) ? document.getElementById('catalog-search')
                                : browser.hidden ? document.getElementById('catalog-results-toolbar') : browser;
                            target.scrollIntoView({ block: 'start' }); resolve();
                        }
                    }, 20); })`, awaitPromise: true });
                const browseScreenshot = await command('Page.captureScreenshot', { format: 'png' });
                writeFileSync(join(previewDirectory, 'catalogue-browse-' + label + '-' + width + '.png'), Buffer.from(browseScreenshot.data, 'base64'));
            }
            await command('Runtime.evaluate', { expression: `history.replaceState({}, '', '?category=vegetables');
                loadProductView(); new Promise(resolve => { const poll = setInterval(() => {
                    if (document.getElementById('catalog-results').getAttribute('aria-busy') === 'false') { clearInterval(poll); resolve(); }
                }, 20); })`, awaitPromise: true });
            await command('Runtime.evaluate', { expression: `document.querySelector('.product-gallery-open').scrollIntoView({ block: 'center' });` });
            const galleryScreenshot = await command('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(previewDirectory, 'catalogue-gallery-' + width + '.png'), Buffer.from(galleryScreenshot.data, 'base64'));
            await command('Runtime.evaluate', { expression: `document.querySelector('.product-gallery-open').click();` });
            const viewerScreenshot = await command('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(previewDirectory, 'catalogue-viewer-' + width + '.png'), Buffer.from(viewerScreenshot.data, 'base64'));
            await command('Runtime.evaluate', { expression: `OrbiCatalog.closeGallery();` });

            if (width === 1440 || width === 375) {
                await command('Runtime.evaluate', { expression: `(async () => {
                    const section = document.querySelector('.product-sec');
                    window.fitPreviewGallery = OrbiCatalog.mountGallery(section, { name: 'Uploaded crop photographs', images: [
                        { url: 'images/cucmber-research.png', alt: 'Portrait crop photograph' },
                        { url: 'images/chillie.webp', alt: 'Landscape crop photograph' }
                    ] });
                    fitPreviewGallery.update(null);
                    const image = section.querySelector('.product-gallery-main'); image.loading = 'eager'; await image.decode();
                    section.querySelector('.product-gallery-open').scrollIntoView({ block: 'center' });
                })()`, awaitPromise: true });
                for (const [label, index] of [['portrait', 0], ['landscape', 1]]) {
                    await command('Runtime.evaluate', { expression: `(async () => {
                        fitPreviewGallery.select(${index}); await document.querySelector('.product-gallery-main').decode();
                    })()`, awaitPromise: true });
                    const fitScreenshot = await command('Page.captureScreenshot', { format: 'png' });
                    writeFileSync(join(previewDirectory, 'catalogue-photo-' + label + '-' + width + '.png'), Buffer.from(fitScreenshot.data, 'base64'));
                }
                await command('Runtime.evaluate', { expression: `(async () => {
                    fitPreviewGallery.select(0); document.querySelector('.product-gallery-open').click();
                    await document.querySelector('.product-image-dialog img').decode();
                })()`, awaitPromise: true });
                const fullPhoto = await command('Page.captureScreenshot', { format: 'png' });
                writeFileSync(join(previewDirectory, 'catalogue-photo-full-' + width + '.png'), Buffer.from(fullPhoto.data, 'base64'));
                await command('Runtime.evaluate', { expression: 'OrbiCatalog.closeGallery();' });
            }

            await command('Runtime.evaluate', { expression: `document.getElementById('catalog-filter-panel').open = true;
                document.getElementById('catalog-category').click();
                var input = document.getElementById('catalog-category-search');
                input.value = 'tomato'; input.dispatchEvent(new Event('input', { bubbles: true }));` });
            const pickerScreenshot = await command('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(previewDirectory, 'catalogue-categories-' + width + '.png'), Buffer.from(pickerScreenshot.data, 'base64'));

        }
        return results;
    } finally {
        clearTimeout(timeout);
        browser.kill();
        await exited;
    }
}

for (const width of [1440, 1024, 768, 375]) {
    test('unified product discovery and responsive layout in Chrome at ' + width + 'px', async () => {
        const directory = mkdtempSync(join(tmpdir(), 'orbi-catalogue-'));
        try {
            const fixture = join(directory, 'catalogue.html');
            const html = fixtureHtml().replace('<html lang="en">', '<html lang="en" data-test-width="' + width + '">');
            writeFileSync(fixture, html);
            writeImageFixtures(directory);
            symlinkSync(resolve(__dirname, '../images'), join(directory, 'images'));
            if (process.env.ORBI_PREVIEW_DIR) {
                mkdirSync(process.env.ORBI_PREVIEW_DIR, { recursive: true });
                writeFileSync(join(process.env.ORBI_PREVIEW_DIR, 'catalogue.html'), html);
                writeImageFixtures(process.env.ORBI_PREVIEW_DIR);
                const images = join(process.env.ORBI_PREVIEW_DIR, 'images');
                if (!existsSync(images)) symlinkSync(resolve(__dirname, '../images'), images);
            }
            const results = await runChrome(fixture, directory, width, process.env.ORBI_PREVIEW_DIR);
            assert.equal(results.length, 42);
            assert.deepEqual(results.filter(result => !result.passed), []);
        } finally {
            // Chrome helpers can finish profile writes just after the main process exits.
            rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        }
    });
}
