import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const script = readFileSync(resolve(import.meta.dirname, '../../../../demo-orbis-seeds-v1-html/js/gallery.js'), 'utf8');
const albums = [{ title: 'Flower', slug: 'flower', description: 'Field photographs' }, { title: 'Gallery', slug: 'gallery' }];
const response = (data, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => data });
const items = (url, totalPages = 1) => ({ success: true, data: { items: [{ media: { url, alt: 'Field trial' } }] }, meta: { totalPages } });
const empty = { success: true, data: { items: [] }, meta: { totalPages: 0 } };
const api = () => vi.fn(async (url) => response(url.endsWith('/public')
  ? { success: true, data: albums } : items(url.includes('/flower?') ? '/uploads/flower.png' : '/uploads/gallery.png')));
let dom;
const mount = (fetchMock, search = '', origin = 'http://localhost:3000') => {
  dom = new JSDOM('<p id="gallery-message" role="status"></p><button id="gallery-retry" hidden>Try again</button><div id="gallery-sections"></div>', {
    url: `${origin}/demo-orbis-seeds-v1-html/gallery.html${search}`, runScripts: 'outside-only',
  });
  dom.window.API_URL = 'https://api.example.com/api/';
  dom.window.APP_URL = 'https://api.example.com/';
  dom.window.fetch = fetchMock;
  dom.window.console.error = vi.fn();
  dom.window.eval(script);
  return dom.window.document;
};
const section = (doc, index) => doc.querySelectorAll('.gallery-album-section')[index];
const loaded = (doc) => waitFor(() => expect(doc.querySelectorAll('.gallery-inner-wrapper img')).toHaveLength(2));
afterEach(() => dom?.window.close());

describe('Orbi gallery album sections', () => {
  it('renders every public album as a titled section with its own images', async () => {
    const fetchMock = api();
    const doc = mount(fetchMock);
    await loaded(doc);
    expect(Array.from(doc.querySelectorAll('section h3'), (heading) => heading.textContent)).toEqual(['Flower', 'Gallery']);
    expect(section(doc, 0).querySelector('img').src).toBe('http://localhost:3000/uploads/flower.png');
    expect(section(doc, 1).querySelector('img').src).toBe('http://localhost:3000/uploads/gallery.png');
    expect(section(doc, 0).querySelector('.gallery-album-description').textContent).toBe('Field photographs');
    expect(doc.querySelector('.gallery-album-button')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(dom.window.location.search).toBe('');
  });

  it('keeps backend album ordering even when image requests finish in reverse order', async () => {
    let resolveFlower;
    const flower = new Promise((resolve) => { resolveFlower = resolve; });
    const fetchMock = api().mockImplementation(async (url) => {
      if (url.endsWith('/public')) return response({ data: albums });
      return url.includes('/flower?') ? flower : response(items('/uploads/gallery.png'));
    });
    const doc = mount(fetchMock);
    await waitFor(() => expect(section(doc, 1)?.querySelector('img')).toBeTruthy());
    expect(section(doc, 0).querySelector('h3').textContent).toBe('Flower');
    resolveFlower(response(items('/uploads/flower.png')));
    await loaded(doc);
  });

  it('preserves the image order returned for each album', async () => {
    const ordered = { data: { items: [{ media: { url: '/uploads/second.png' } }, { media: { url: '/uploads/first.png' } }] }, meta: { totalPages: 1 } };
    const fetchMock = api().mockImplementation(async (url) => response(url.endsWith('/public') ? { data: albums } : ordered));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.querySelectorAll('.gallery-inner-wrapper img')).toHaveLength(4));
    expect(Array.from(section(doc, 0).querySelectorAll('img'), (img) => new URL(img.src).pathname))
      .toEqual(['/uploads/second.png', '/uploads/first.png']);
  });

  it('uses the configured production API and media host', async () => {
    const fetchMock = api();
    const doc = mount(fetchMock, '', 'https://orbiseeds.example');
    await loaded(doc);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/galleries/public');
    expect(section(doc, 0).querySelector('img').src).toBe('https://api.example.com/uploads/flower.png');
  });

  it('groups lightbox images separately for each album and preserves alt text', async () => {
    const doc = mount(api());
    await loaded(doc);
    const links = doc.querySelectorAll('.gallery-inner-wrapper a');
    expect(links[0].getAttribute('data-fancybox')).not.toBe(links[1].getAttribute('data-fancybox'));
    expect(links[0].querySelector('img').alt).toBe('Field trial');
    expect(links[0].getAttribute('aria-label')).toBe('View image: Field trial');
  });

  it('paginates one section without replacing the other section', async () => {
    const fetchMock = api().mockImplementation(async (url) => {
      if (url.endsWith('/public')) return response({ data: albums });
      if (url.includes('/gallery?')) return response(items('/uploads/gallery.png'));
      return response(items(url.includes('page=2') ? '/uploads/flower-2.png' : '/uploads/flower.png', 2));
    });
    const doc = mount(fetchMock);
    await loaded(doc);
    section(doc, 0).querySelector('[aria-label="Next page"]').click();
    await waitFor(() => expect(section(doc, 0).querySelector('img')?.src).toContain('flower-2.png'));
    expect(section(doc, 1).querySelector('img').src).toContain('/uploads/gallery.png');
    expect(section(doc, 0).querySelector('[aria-current="page"]').textContent).toBe('2');
    expect(section(doc, 0).querySelector('[aria-label="Next page"]').disabled).toBe(true);
    expect(dom.window.location.search).toBe('?album=flower&page=2');
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('/gallery?'))).toHaveLength(1);
  });

  it('opens deep-linked album pages while still displaying all other sections', async () => {
    const fetchMock = api().mockImplementation(async (url) => {
      if (url.endsWith('/public')) return response({ data: albums });
      if (url.includes('page=99')) return response({ data: { items: [] }, meta: { totalPages: 2 } });
      return response(items(url.includes('/gallery?') ? '/uploads/gallery.png' : '/uploads/flower.png', 2));
    });
    const doc = mount(fetchMock, '?album=gallery&page=99');
    await loaded(doc);
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/flower?page=1'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/gallery?page=2'))).toBe(true);
    expect(dom.window.location.search).toBe('?album=gallery&page=2');
  });

  it('ignores outdated responses for the same section', async () => {
    let resolveSecond;
    const second = new Promise((resolve) => { resolveSecond = resolve; });
    const fetchMock = api().mockImplementation(async (url) => {
      if (url.endsWith('/public')) return response({ data: albums });
      if (url.includes('/gallery?')) return response(items('/uploads/gallery.png'));
      if (url.includes('page=2')) return second;
      return response(items(url.includes('page=3') ? '/uploads/third.png' : '/uploads/flower.png', 3));
    });
    const doc = mount(fetchMock);
    await loaded(doc);
    const page2 = section(doc, 0).querySelector('[aria-label="Page 2"]');
    const page3 = section(doc, 0).querySelector('[aria-label="Page 3"]');
    page2.click();
    page3.click();
    await waitFor(() => expect(section(doc, 0).querySelector('img')?.src).toContain('third.png'));
    resolveSecond(response(items('/uploads/second.png', 3)));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(section(doc, 0).querySelector('img').src).toContain('third.png');
  });

  it('retries only a failed section and leaves successful albums visible', async () => {
    let flowerCalls = 0;
    const fetchMock = api().mockImplementation(async (url) => {
      if (url.endsWith('/public')) return response({ data: albums });
      if (url.includes('/flower?') && ++flowerCalls === 1) return response({}, false);
      return response(items('/uploads/recovered.png'));
    });
    const doc = mount(fetchMock);
    await waitFor(() => expect(section(doc, 0)?.querySelector('.gallery-retry').hidden).toBe(false));
    await waitFor(() => expect(section(doc, 1).querySelector('img')).not.toBeNull());
    section(doc, 0).querySelector('.gallery-retry').click();
    await loaded(doc);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('/gallery?'))).toHaveLength(1);
    expect(section(doc, 0).querySelector('.gallery-retry').hidden).toBe(true);
  });

  it('retries album discovery when the album list request fails', async () => {
    const fetchMock = api().mockResolvedValueOnce(response({}, false));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.getElementById('gallery-retry').hidden).toBe(false));
    doc.getElementById('gallery-retry').click();
    await loaded(doc);
    expect(doc.getElementById('gallery-retry').hidden).toBe(true);
  });

  it('keeps an empty album heading and shows its empty state', async () => {
    const fetchMock = api().mockImplementation(async (url) => response(url.endsWith('/public')
      ? { data: albums } : url.includes('/flower?') ? empty : items('/uploads/gallery.png')));
    const doc = mount(fetchMock, '?album=flower&page=9');
    await waitFor(() => expect(section(doc, 0)?.querySelector('.gallery-inner-wrapper').getAttribute('aria-busy')).toBe('false'));
    expect(section(doc, 0).querySelector('h3').textContent).toBe('Flower');
    expect(section(doc, 0).querySelector('.gallery-album-message').textContent).toBe('No gallery items found.');
    expect(section(doc, 1).querySelector('img')).not.toBeNull();
    expect(dom.window.location.search).toBe('?album=flower');
  });

  it('shows an empty page when there are no public albums', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ data: [] }));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.getElementById('gallery-message').textContent).toContain('No gallery albums'));
    expect(doc.querySelector('section')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders titles as text and ignores unsafe media URL protocols', async () => {
    const title = '<img src=x onerror=alert(1)>';
    const fetchMock = vi.fn().mockImplementation(async (url) => response(url.endsWith('/public')
      ? { data: [{ title, slug: 'unsafe' }] } : items('javascript:alert(1)')));
    const doc = mount(fetchMock);
    await waitFor(() => expect(section(doc, 0)?.querySelector('.gallery-inner-wrapper').getAttribute('aria-busy')).toBe('false'));
    expect(section(doc, 0).querySelector('h3').textContent).toBe(title);
    expect(section(doc, 0).querySelector('img')).toBeNull();
    expect(section(doc, 0).querySelector('a')).toBeNull();
  });
});
