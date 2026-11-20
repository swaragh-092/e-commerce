import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const storefront = resolve(import.meta.dirname, '../../../../demo-orbis-seeds-v1-html');
const source = (file) => readFileSync(resolve(storefront, file), 'utf8');
let dom;

function mount(response, html = source('page.html')) {
  dom = new JSDOM(html, { url: 'http://localhost/page.html?slug=page-check', runScripts: 'outside-only' });
  const { window } = dom;
  window.APP_URL = 'https://api.example.test/';
  window.API_URL = 'https://api.example.test/api/';
  window.fetch = vi.fn(async (url) => url.includes('/seo/orbi/metadata') ? { ok: false } : response);
  for (const file of ['catalog.js', 'seo-routes.js', 'seo.js', 'vendor/dompurify.min.js', 'page.js']) {
    window.eval(source('js/' + file));
  }
  return window;
}

afterEach(() => dom?.window.close());

it('loads published content, banner and metadata into the standard Orbi layout on static hosts', async () => {
  const window = mount({ ok: true, json: async () => ({ success: true, data: {
    title: 'Page Check', metaTitle: 'Page Check for growers', metaDescription: 'Published page description',
    bannerUrl: '/uploads/field.jpg',
    content: '<h1>About seed growers</h1><p style="font-weight: bold; position: fixed">Hello!</p><img src="/uploads/seeds.jpg" alt="Growing seeds" onerror="bad()"><script>bad()</script>',
  } }) });
  const { document } = window;
  await waitFor(() => expect(document.querySelector('h1').textContent).toBe('Page Check'));
  expect(window.fetch).toHaveBeenCalledWith('https://api.example.test/api/pages/public/page-check');
  expect(document.querySelector('header .nav-links')).not.toBeNull();
  expect(document.querySelectorAll('footer [data-orbi-footer-menu]')).toHaveLength(2);
  expect(document.querySelector('.cms-banner-image').src).toBe('https://api.example.test/uploads/field.jpg');
  expect(document.getElementById('cms-page-breadcrumb').textContent).toBe('Page Check');
  const content = document.getElementById('cms-page-content');
  expect(content.querySelector('h2').textContent).toBe('About seed growers');
  expect(content.querySelector('p').style.fontWeight).toBe('bold');
  expect(content.querySelector('p').style.position).toBe('');
  expect(content.querySelector('img').alt).toBe('Growing seeds');
  expect(content.querySelector('img').src).toBe('https://api.example.test/uploads/seeds.jpg');
  expect(content.querySelector('script, [onerror]')).toBeNull();
  expect(document.title).toBe('Page Check for growers | Orbi Seeds');
  expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  expect(document.querySelector('meta[name="description"]').content).toBe('Published page description');
});

it('keeps the existing shell and marks unpublished pages noindex', async () => {
  const window = mount({ ok: false, status: 404, json: async () => ({ success: false }) });
  await waitFor(() => expect(window.document.querySelector('h1').textContent).toBe('Page unavailable'));
  expect(window.document.querySelector('meta[name="robots"]').content).toContain('noindex');
  expect(window.document.querySelector('footer')).not.toBeNull();
});

it('keeps Express-rendered content without fetching the page again', () => {
  const html = source('page.html')
    .replace('</head>', '<meta name="orbi-seo-rendered" content="true"></head>')
    .replace(/<!-- orbi-cms-start -->[\s\S]*?<!-- orbi-cms-end -->/, '<div data-orbi-cms-rendered><p>Already rendered</p></div>');
  const window = mount(undefined, html);
  expect(window.fetch).not.toHaveBeenCalled();
  expect(window.document.querySelector('#cms-page-content p').textContent).toBe('Already rendered');
});
