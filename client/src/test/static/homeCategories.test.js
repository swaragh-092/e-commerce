import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { waitFor } from '@testing-library/react';
import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';

const storefront = resolve(import.meta.dirname, '../../../../demo-orbis-seeds-v1-html');
const source = (file) => readFileSync(resolve(storefront, file), 'utf8');

it('renders up to four subcategories per group in the order returned by the category manager API', async () => {
  const children = [
    { name: 'Tomato', slug: 'tomato' },
    { name: 'Cabbage', slug: 'cabbage', icon: '/uploads/cabbage.png' },
    { name: 'Peppers', slug: 'peppers', children: [{ name: 'Sweet Pepper', slug: 'sweet-pepper' }] },
    { name: 'Okra', slug: 'okra' },
    { name: 'Cauliflower', slug: 'cauliflower' },
    { name: 'Eggplant', slug: 'eggplant' },
  ];
  const categories = [
    { name: 'Vegetables', slug: 'vegetables', children },
    { name: 'Flowers', slug: 'flowers', children: [{ name: 'Marigold', slug: 'marigold' }] },
  ];
  const { window } = new JSDOM(source('index.html'), { runScripts: 'outside-only' });
  try {
    window.API_URL = 'https://backend.test/api/';
    window.APP_URL = 'https://backend.test/';
    window.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ success: true, data: categories }),
    });
    window.eval(source('js/catalog.js'));
    window.eval(source('js/index.js'));

    const container = window.document.getElementById('orbis-home-section-categories');
    const textOf = (selector) => Array.from(container.querySelectorAll(selector), (node) => node.textContent.trim());
    await waitFor(() => expect(textOf('.variety-of-seeds-1 h3')).toEqual([
      'Tomato', 'Cabbage', 'Peppers', 'Okra', 'Marigold',
    ]));
    expect(textOf('.category-label')).toEqual(['Vegetables', 'Flowers']);
    expect(window.fetch).toHaveBeenCalledExactlyOnceWith('https://backend.test/api/categories');
    expect(container.querySelector('a[href="product.html?cat=peppers"]')).not.toBeNull();
    expect(container.querySelector('a[href="products.html?category=okra"]')).not.toBeNull();
    expect(container.querySelector('a[href="products.html?category=eggplant"]')).toBeNull();
    expect(container.querySelector('.variety-of-seeds-1 img').getAttribute('src')).toBe('images/variety-of-seeds/tomato.png');
  } finally {
    window.close();
  }
});
