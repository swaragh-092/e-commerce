import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';

const storefront = resolve(import.meta.dirname, '../../../../demo-orbis-seeds-v1-html');
const source = (file) => readFileSync(resolve(storefront, file), 'utf8');

const require = createRequire(import.meta.url);
const { resolve: resolveRoute } = require(resolve(storefront, 'js/seo-routes.js'));

it.each([
  'index.html', 'about-orbis.html', 'research-and-development.html', 'partners.html',
  'resources.html', 'gallery.html', 'contact-us.html',
])('includes the approved copy in the static HTML for %s', (file) => {
  const { approvedCopy } = resolveRoute(file, new URLSearchParams());
  const { window } = new JSDOM(source(file));
  try {
    expect(window.document.title).toBe(approvedCopy.metaTitle);
    expect(window.document.querySelector('meta[name="description"]').content).toBe(approvedCopy.metaDescription);
    expect(window.document.querySelector('meta[property="og:title"]').content).toBe(approvedCopy.metaTitle);
    expect(window.document.querySelector('meta[name="twitter:description"]').content).toBe(approvedCopy.metaDescription);
  } finally {
    window.close();
  }
});

it.each([
  ['product.html', '?cat=flowers'],
  ['gallery-detail.html', '?album=fresh-fruits'],
])('uses the approved copy for %s%s before the backend responds', (file, query) => {
  const { approvedCopy } = resolveRoute(file, new URLSearchParams(query));
  const { window } = new JSDOM(source(file), {
    url: 'https://seeds.test/store/' + file + query, runScripts: 'outside-only',
  });
  try {
    window.API_URL = 'https://backend.test/api/';
    window.fetch = vi.fn().mockResolvedValue({ ok: false });
    for (const script of ['seo-routes.js', 'seo.js']) window.eval(source('js/' + script));
    expect(window.document.title).toBe(approvedCopy.metaTitle);
    window.OrbiSEO.refresh({ name: 'Backend name', metaTitle: 'Saved title', metaDescription: ' ' });
    expect(window.document.title).toBe('Saved title');
    expect(window.document.querySelector('meta[name="description"]').content).toBe(approvedCopy.metaDescription);
  } finally {
    window.close();
  }
});

it('updates one canonical and preserves the selected product when backend metadata is unavailable', async () => {
  const dom = new JSDOM(source('products.html'), {
    url: 'https://seeds.test/store/products.html?category=vegetables&slug=tomato&variant=small',
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.API_URL = 'https://backend.test/api/';
  window.APP_URL = 'https://backend.test/';
  window.fetch = vi.fn().mockResolvedValue({ ok: false });
  try {
    for (const file of ['catalog.js', 'seo-routes.js', 'seo.js']) window.eval(source('js/' + file));
    window.OrbiSEO.refresh({
      name: 'Tomato', metaTitle: 'Compact tomato seeds',
      images: [{ url: '/uploads/tomato.jpg', media: { alt: 'Tomatoes growing on a vine' } }],
    });
    const { document } = window;
    expect(document.title).toBe('Compact tomato seeds | Orbi Seeds');
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelector('link[rel="canonical"]').href).toBe('https://seeds.test/store/products.html?slug=tomato');
    expect(document.querySelector('[property="og:image:alt"]').content).toBe('Tomatoes growing on a vine');
    expect(document.querySelector('[property="og:image"]').content).toBe('https://backend.test/uploads/tomato.jpg');
    expect(window.fetch).toHaveBeenCalledTimes(1);

    window.history.replaceState({}, '', '?category=vegetables&q=tomato');
    window.OrbiSEO.refresh();
    expect(document.title).toBe('Seed Catalogue | Orbi Seeds');
    expect(document.querySelector('meta[name="robots"]').content).toContain('noindex');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  } finally {
    window.close();
  }
});

it('keeps metadata already rendered by the server until the URL changes', () => {
  const dom = new JSDOM('<title>Admin override</title><meta name="orbi-seo-rendered" content="true">', {
    url: 'https://seeds.test/products.html?slug=tomato', runScripts: 'outside-only',
  });
  try {
    dom.window.fetch = vi.fn();
    dom.window.eval(source('js/seo-routes.js'));
    dom.window.eval(source('js/seo.js'));
    dom.window.OrbiSEO.refresh({ name: 'Tomato' });
    expect(dom.window.fetch).not.toHaveBeenCalled();
    expect(dom.window.document.title).toBe('Admin override');
  } finally {
    dom.window.close();
  }
});

it('keeps public menu entity links on the Orbi storefront', () => {
  const dom = new JSDOM('<span id="current-year"></span>', {
    url: 'https://seeds.test/store/index.html', runScripts: 'outside-only',
  });
  try {
    const { window } = dom;
    window.$ = () => ({ length: 0, ready() {}, on() {} });
    window.eval(source('js/common.js'));

    expect(window.getMenuItemUrl({ targetType: 'page', url: '/p/shipping-policy' })).toBe('page.html?slug=shipping-policy');
    expect(window.getMenuItemUrl({
      targetType: 'product', url: '/products/cherry-tomato?variant=packet&category=tomatoes',
      children: [{ label: 'Details' }],
    })).toBe('products.html?variant=packet&category=tomatoes&slug=cherry-tomato');
    expect(window.getMenuItemUrl({
      targetType: 'category', url: '/products?category=vegetables', children: [{ label: 'Tomatoes' }],
    })).toBe('product.html?cat=vegetables');
    expect(window.formatMenuUrl('/blogs/seed-guide#tips')).toBe('resource.html?slug=seed-guide#tips');
  } finally {
    dom.window.close();
  }
});

it('renders each Orbi footer placement separately in backend order', async () => {
  const dom = new JSDOM(source('about-orbis.html'), {
    url: 'https://seeds.test/store/page.html?slug=page-check', runScripts: 'outside-only',
  });
  try {
    const { window } = dom;
    window.$ = () => ({ length: 0, ready() {}, on() {} });
    window.API_URL = 'https://backend.test/api/';
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { items: [
        { label: 'Page Check', placement: 'footer_column', targetType: 'page', url: '/p/page-check' },
        { label: 'Hidden', placement: 'footer_column', isVisible: false, url: '/hidden' },
        { label: 'Partner', placement: 'quick_links', url: 'https://partner.test/about', openInNewTab: true },
        { label: 'Category group', placement: 'quick_links', children: [
          { label: 'Flowers', url: '/products?category=flowers' },
          { label: 'Seed guide', placement: 'footer_column', url: '/blogs/seed-guide' },
        ] },
      ] } }),
    });
    window.eval(source('js/common.js'));
    window.eval('setActiveLinks = function () {}');
    await window.fetchAndRenderFooterMenu();
    expect(window.fetch).toHaveBeenCalledWith('https://backend.test/api/menus/slug/public/otbi-footer?hideEmpty=true');
    const quickLinks = window.document.querySelector('[data-orbi-footer-menu="quick_links"]');
    const footerColumn = window.document.querySelector('[data-orbi-footer-menu="footer_column"]');
    const links = (section) => Array.from(section.querySelectorAll('a'), (link) => [link.textContent, link.getAttribute('href')]);
    expect(quickLinks.hidden).toBe(false);
    expect(footerColumn.hidden).toBe(false);
    expect(links(quickLinks)).toEqual([
      ['Partner', 'https://partner.test/about'],
      ['Flowers', 'products.html?category=flowers'],
    ]);
    expect(links(footerColumn)).toEqual([
      ['Page Check', 'page.html?slug=page-check'],
      ['Seed guide', 'resource.html?slug=seed-guide'],
    ]);
    const partner = quickLinks.querySelector('a');
    expect(partner.target).toBe('_blank');
    expect(partner.rel).toBe('noopener noreferrer');

    window.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { items: [{ label: 'Page Check', placement: 'footer_column', url: '/p/page-check' }] } }),
    });
    await window.fetchAndRenderFooterMenu();
    expect(quickLinks.hidden).toBe(true);
    expect(footerColumn.hidden).toBe(false);
  } finally {
    dom.window.close();
  }
});
