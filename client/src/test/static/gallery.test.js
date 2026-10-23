import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const script = readFileSync(resolve(import.meta.dirname, '../../../../demo-orbis-seeds-v1-html/js/gallery.js'), 'utf8');
const albums = [{ title: 'Africa', slug: 'africa' }, { title: 'India', slug: 'india' }];
const albumResponse = { success: true, data: albums };
const itemResponse = (url = '/uploads/africa.png', pages = 1) => ({
  success: true, data: { gallery: albums[0], items: [{ media: { url, alt: 'Field trial in Africa' } }] },
  meta: { totalPages: pages },
});
const response = (data, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => data });
let dom;
const mount = (fetchMock, search = '', origin = 'http://localhost:3000') => {
  dom = new JSDOM(`<div id="gallery-albums"></div><p id="gallery-message"></p>
    <button id="gallery-retry" hidden>Try again</button><div class="gallery-inner-wrapper"></div>
    <nav id="gallery-pagination"></nav>`, {
    url: `${origin}/demo-orbis-seeds-v1-html/gallery.html${search}`, runScripts: 'outside-only',
  });
  dom.window.API_URL = 'https://api.example.com/api/';
  dom.window.APP_URL = 'https://api.example.com/';
  dom.window.fetch = fetchMock;
  dom.window.console.error = vi.fn();
  dom.window.eval(script);
  return dom.window.document;
};
afterEach(() => dom?.window.close());

describe('Orbi public gallery integration', () => {
  it('loads backend albums and images from the same local server', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(albumResponse)).mockResolvedValueOnce(response(itemResponse()));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.querySelector('img')).not.toBeNull());
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/galleries/public');
    expect(fetchMock.mock.calls[1][0]).toContain('/galleries/public/africa?page=1');
    expect(doc.querySelector('img').src).toBe('http://localhost:3000/uploads/africa.png');
    expect(doc.querySelector('img').alt).toBe('Field trial in Africa');
    expect(doc.querySelectorAll('.gallery-album-button')).toHaveLength(2);
  });

  it('uses the configured API and media host on the published static site', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(albumResponse)).mockResolvedValueOnce(response(itemResponse()));
    const doc = mount(fetchMock, '', 'https://orbiseeds.example');
    await waitFor(() => expect(doc.querySelector('img')).not.toBeNull());
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/galleries/public');
    expect(doc.querySelector('img').src).toBe('https://api.example.com/uploads/africa.png');
  });

  it('honors album and page deep links and recovers from out-of-range pages', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(albumResponse))
      .mockResolvedValueOnce(response({ data: { items: [] }, meta: { totalPages: 2 } }))
      .mockResolvedValueOnce(response(itemResponse('/uploads/india.png', 2)));
    const doc = mount(fetchMock, '?album=india&page=99');
    await waitFor(() => expect(doc.querySelector('img')?.src).toContain('/uploads/india.png'));
    expect(fetchMock.mock.calls[1][0]).toContain('/india?page=99');
    expect(fetchMock.mock.calls[2][0]).toContain('/india?page=2');
    expect(dom.window.location.search).toBe('?album=india&page=2');
  });

  it('ignores a slow previous album response after switching albums', async () => {
    let resolveFirst;
    const first = new Promise((resolve) => { resolveFirst = resolve; });
    const fetchMock = vi.fn().mockResolvedValueOnce(response(albumResponse))
      .mockReturnValueOnce(first).mockResolvedValueOnce(response(itemResponse('/uploads/india.png')));
    const doc = mount(fetchMock);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    doc.querySelectorAll('.gallery-album-button')[1].click();
    await waitFor(() => expect(doc.querySelector('img')?.src).toContain('india.png'));
    resolveFirst(response(itemResponse('/uploads/africa.png')));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(doc.querySelector('img').src).toContain('india.png');
  });

  it('offers a working retry when the album list fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({}, false))
      .mockResolvedValueOnce(response(albumResponse)).mockResolvedValueOnce(response(itemResponse()));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.getElementById('gallery-retry').hidden).toBe(false));
    doc.getElementById('gallery-retry').click();
    await waitFor(() => expect(doc.querySelector('img')).not.toBeNull());
    expect(doc.getElementById('gallery-retry').hidden).toBe(true);
  });

  it('retries the selected album without restarting album discovery', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(albumResponse))
      .mockResolvedValueOnce(response({}, false)).mockResolvedValueOnce(response(itemResponse()));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.getElementById('gallery-retry').hidden).toBe(false));
    doc.getElementById('gallery-retry').click();
    await waitFor(() => expect(doc.querySelector('img')).not.toBeNull());
    expect(fetchMock.mock.calls[2][0]).toContain('/galleries/public/africa?page=1');
  });

  it('keeps page-only deep links and provides accessible pagination', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(albumResponse))
      .mockResolvedValueOnce(response(itemResponse('/uploads/africa.png', 3)))
      .mockResolvedValueOnce(response(itemResponse('/uploads/next.png', 3)));
    const doc = mount(fetchMock, '?page=2');
    await waitFor(() => expect(doc.querySelector('[aria-current="page"]')?.textContent).toBe('2'));
    expect(fetchMock.mock.calls[1][0]).toContain('page=2');
    doc.querySelector('[aria-label="Next page"]').click();
    await waitFor(() => expect(doc.querySelector('img')?.src).toContain('/uploads/next.png'));
    expect(dom.window.location.search).toBe('?album=africa&page=3');
    expect(doc.querySelector('[aria-label="Next page"]').disabled).toBe(true);
  });

  it('shows an empty image state and clears loading status', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(albumResponse))
      .mockResolvedValueOnce(response({ data: { items: [] }, meta: { totalPages: 0 } }));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.querySelector('.gallery-inner-wrapper').getAttribute('aria-busy')).toBe('false'));
    expect(doc.getElementById('gallery-message').textContent).toBe('No gallery items found.');
    expect(doc.getElementById('gallery-retry').hidden).toBe(true);
  });

  it('resets a page deep link to page one for an empty album', async () => {
    const emptyAlbum = response({ data: { items: [] }, meta: { totalPages: 0, total: 0 } });
    const fetchMock = vi.fn().mockResolvedValueOnce(response(albumResponse))
      .mockResolvedValueOnce(emptyAlbum).mockResolvedValueOnce(emptyAlbum);
    const doc = mount(fetchMock, '?album=africa&page=9');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(doc.querySelector('.gallery-inner-wrapper').getAttribute('aria-busy')).toBe('false'));
    expect(fetchMock.mock.calls[2][0]).toContain('page=1');
    expect(dom.window.location.search).toBe('?album=africa');
  });

  it('preserves absolute media URLs without adding the API host', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(albumResponse))
      .mockResolvedValueOnce(response(itemResponse('https://cdn.example.com/image.png')));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.querySelector('img')?.src).toBe('https://cdn.example.com/image.png'));
  });

  it('shows an empty state when no albums have been published', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ success: true, data: [] }));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.getElementById('gallery-message').textContent).toContain('No gallery albums'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects non-web image URLs returned by the API', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(albumResponse))
      .mockResolvedValueOnce(response(itemResponse('javascript:alert(1)')));
    const doc = mount(fetchMock);
    await waitFor(() => expect(doc.getElementById('gallery-message').textContent).toContain('No gallery items'));
    expect(doc.querySelector('a')).toBeNull();
  });
});
