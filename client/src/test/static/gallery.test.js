import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const script = readFileSync(resolve(import.meta.dirname, '../../../../demo-orbis-seeds-v1-html/js/gallery.js'), 'utf8');
const albums = [
  { title: 'Flower', slug: 'flower', coverImage: { url: '/cover.png' } },
  { title: 'Gallery', slug: 'gallery', coverImage: { url: '/first.png' } },
];
const response = (data, ok = true, status = 500) => ({ ok, status: ok ? 200 : status, json: async () => data });
const detail = (urls = ['/one.png', '/two.png'], totalPages = 1) => ({
  data: { gallery: { title: 'Flower', description: 'Flower photographs' }, items: urls.map((url) => ({ media: { url, alt: 'Flower image' } })) },
  meta: { totalPages },
});
let dom;
const mount = (fetchMock, { view = 'index', query = '', origin = 'http://localhost:3000', api = 'https://api.example.com/api/', media = 'https://api.example.com/' } = {}) => {
  dom = new JSDOM(`<h2 id="gallery-title">Gallery</h2><p id="gallery-description" hidden></p><span id="gallery-breadcrumb-title"></span>
    <p id="gallery-message" role="status"></p><button id="gallery-retry" hidden>Try again</button>
    <div id="gallery-content" class="gallery-album-list" data-gallery-view="${view}"></div>`, {
    url: `${origin}/${view === 'detail' ? 'gallery-detail.html' : 'gallery.html'}${query}`, runScripts: 'outside-only',
  });
  dom.window.API_URL = api;
  dom.window.APP_URL = media;
  dom.window.fetch = fetchMock;
  dom.window.console.error = vi.fn();
  dom.window.eval(script);
  return dom.window.document;
};
const ready = (doc) => waitFor(() => expect(doc.getElementById('gallery-content').getAttribute('aria-busy')).toBe('false'));
afterEach(() => dom?.window.close());

describe('Orbi gallery album cards', () => {
  it('shows one cover card per album and links to a separate detail page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ data: albums }));
    const doc = mount(fetchMock);
    await ready(doc);
    const cards = doc.querySelectorAll('.gallery-album-card');
    expect(cards).toHaveLength(2);
    expect(Array.from(cards, (card) => card.querySelector('h3').textContent)).toEqual(['Flower', 'Gallery']);
    expect(cards[0].href).toBe('http://localhost:3000/gallery-detail.html?album=flower');
    expect(cards[0].querySelector('img').src).toBe('https://api.example.com/cover.png');
    expect(cards[1].querySelector('img').src).toBe('https://api.example.com/first.png');
    expect(doc.querySelector('.gallery-inner-wrapper')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the first image for older API deployments that do not yet return cover metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ data: [{ title: 'Flower', slug: 'flower' }] }))
      .mockResolvedValueOnce(response(detail(['/first-image.png'])));
    const doc = mount(fetchMock);
    await ready(doc);
    expect(doc.querySelector('.gallery-album-card img').src).toBe('https://api.example.com/first-image.png');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.com/api/galleries/public/flower?page=1&limit=1');
  });

  it('keeps empty albums clickable with a placeholder instead of a broken image', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ data: [{ title: 'Empty', slug: 'empty', coverImage: null }] }));
    const doc = mount(fetchMock);
    await ready(doc);
    expect(doc.querySelector('.gallery-album-card').href).toContain('gallery-detail.html?album=empty');
    expect(doc.querySelector('.gallery-cover-empty').textContent).toBe('No cover photo available');
    expect(doc.querySelector('img')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a gallery card usable when its cover image cannot load', async () => {
    const doc = mount(vi.fn().mockResolvedValue(response({ data: albums })));
    await ready(doc);
    doc.querySelector('img').dispatchEvent(new dom.window.Event('error'));
    expect(doc.querySelector('.gallery-album-card .gallery-cover-empty')).not.toBeNull();
    expect(doc.querySelector('.gallery-album-card').href).toContain('album=flower');
  });

  it('does not hide other albums when a legacy cover lookup fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ data: [{ title: 'Legacy', slug: 'legacy' }, albums[0]] }))
      .mockResolvedValueOnce(response({}, false));
    const doc = mount(fetchMock);
    await ready(doc);
    expect(doc.querySelectorAll('.gallery-album-card')).toHaveLength(2);
    expect(doc.querySelectorAll('.gallery-album-card img')).toHaveLength(1);
  });

  it('retries discovery and displays an empty state when no galleries are public', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({}, false)).mockResolvedValueOnce(response({ data: [] }));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.getElementById('gallery-retry').hidden).toBe(false));
    doc.getElementById('gallery-retry').click();
    await ready(doc);
    expect(doc.getElementById('gallery-message').textContent).toBe('No galleries are available yet.');
    expect(doc.querySelector('.gallery-album-card')).toBeNull();
  });

  it('renders unsafe titles as text and ignores non-web cover URLs', async () => {
    const title = '<img src=x onerror=alert(1)>';
    const doc = mount(vi.fn().mockResolvedValue(response({ data: [{ title, slug: 'unsafe', coverImage: { url: 'javascript:alert(1)' } }] })));
    await ready(doc);
    expect(doc.querySelector('h3').textContent).toBe(title);
    expect(doc.querySelector('img')).toBeNull();
  });

  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000', 'https://orbiseeds.example'])('honors configured API and media URLs on %s', async (origin) => {
    const fetchMock = vi.fn().mockResolvedValue(response({ data: albums }));
    const doc = mount(fetchMock, { origin, api: 'https://api.example.com/api' });
    await ready(doc);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/galleries/public');
    expect(doc.querySelector('img').src).toBe('https://api.example.com/cover.png');
  });

  it('supports explicitly configured local API and media servers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ data: albums }));
    const doc = mount(fetchMock, { api: 'http://localhost:5000/api/', media: 'http://localhost:5000/' });
    await ready(doc);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:5000/api/galleries/public');
    expect(doc.querySelector('img').src).toBe('http://localhost:5000/cover.png');
  });
});

describe('Orbi gallery detail page', () => {
  it('loads only the clicked album, sets its title and preserves image order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(detail()));
    const doc = mount(fetchMock, { view: 'detail', query: '?album=flower' });
    await ready(doc);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/galleries/public/flower?page=1&limit=20');
    expect(doc.getElementById('gallery-title').textContent).toBe('Flower');
    expect(doc.getElementById('gallery-description').textContent).toBe('Flower photographs');
    expect(Array.from(doc.querySelectorAll('.gallery-inner-wrapper img'), (img) => new URL(img.src).pathname)).toEqual(['/one.png', '/two.png']);
    expect(doc.querySelector('.gallery-back').getAttribute('href')).toBe('gallery.html');
    expect(doc.querySelector('.gallery-album-card')).toBeNull();
  });

  it('paginates album images and corrects out-of-range page links', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(detail([], 2)))
      .mockResolvedValueOnce(response(detail(['/second-page.png'], 2)))
      .mockResolvedValueOnce(response(detail(['/first-page.png'], 2)));
    const doc = mount(fetchMock, { view: 'detail', query: '?album=flower&page=99' });
    await ready(doc);
    expect(fetchMock.mock.calls[1][0]).toContain('page=2');
    expect(dom.window.location.search).toBe('?album=flower&page=2');
    expect(doc.querySelector('[aria-current="page"]').textContent).toBe('2');
    doc.querySelector('[aria-label="Previous page"]').click();
    await ready(doc);
    expect(doc.querySelector('img').src).toContain('/first-page.png');
    expect(dom.window.location.search).toBe('?album=flower');
  });

  it('ignores an older pagination response after a newer page finishes', async () => {
    let resolveSecond;
    const second = new Promise((resolve) => { resolveSecond = resolve; });
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      if (url.includes('page=2')) return second;
      return response(detail([url.includes('page=3') ? '/third.png' : '/first.png'], 3));
    });
    const doc = mount(fetchMock, { view: 'detail', query: '?album=flower' });
    await ready(doc);
    const page2 = doc.querySelector('[aria-label="Page 2"]');
    const page3 = doc.querySelector('[aria-label="Page 3"]');
    page2.click();
    page3.click();
    await ready(doc);
    resolveSecond(response(detail(['/second.png'], 3)));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(doc.querySelector('img').src).toContain('/third.png');
    expect(dom.window.location.search).toBe('?album=flower&page=3');
  });

  it('keeps older album links working', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(detail()));
    const doc = mount(fetchMock, { query: '?album=flower' });
    await ready(doc);
    expect(doc.querySelectorAll('.gallery-inner-wrapper img')).toHaveLength(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/public/flower?');
  });

  it('handles empty, unavailable and missing album links', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({}, false, 404));
    const doc = mount(fetchMock, { view: 'detail', query: '?album=private' });
    await ready(doc);
    expect(doc.getElementById('gallery-message').textContent).toContain('unavailable or no longer public');
    expect(doc.getElementById('gallery-retry').hidden).toBe(true);
  });

  it('shows a message for an empty album', async () => {
    const doc = mount(vi.fn().mockResolvedValue(response(detail([], 0))), { view: 'detail', query: '?album=empty' });
    await ready(doc);
    expect(doc.getElementById('gallery-message').textContent).toBe('This gallery has no images yet.');
  });

  it('does not make an API request without an album slug', async () => {
    const fetchMock = vi.fn();
    const doc = mount(fetchMock, { view: 'detail' });
    await ready(doc);
    expect(doc.getElementById('gallery-message').textContent).toContain('Choose a gallery');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries a temporary image request failure', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({}, false)).mockResolvedValueOnce(response(detail()));
    const doc = mount(fetchMock, { view: 'detail', query: '?album=flower' });
    await waitFor(() => expect(doc.getElementById('gallery-retry').hidden).toBe(false));
    doc.getElementById('gallery-retry').click();
    await ready(doc);
    expect(doc.querySelectorAll('img')).toHaveLength(2);
  });
});
