import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';

const storefront = resolve(import.meta.dirname, '../../../../demo-orbis-seeds-v1-html');
const source = (file) => readFileSync(resolve(storefront, file), 'utf8');

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
