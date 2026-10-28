import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const tags = require('../../src/modules/product/tag.service');
const seo = require('../../src/modules/seo/seo.service');
const { crawlerPrerender } = require('../../src/middleware/crawlerPrerender.middleware');
const defaults = { title: 'Store', description: 'Default description', siteName: 'Store', titleSuffix: ' | Store', canonicalBaseUrl: 'https://shop.example.test' };
beforeEach(() => { vi.spyOn(db.SeoOverride, 'findOne').mockResolvedValue(null); vi.spyOn(seo, '_getGlobalDefaults').mockResolvedValue(defaults); });
afterEach(() => vi.restoreAllMocks());

describe('tag SEO', () => {
  it('uses tag names, descriptions and canonical paths independently of query filters', async () => {
    vi.spyOn(tags, 'getPublicTagBySlug').mockResolvedValue({ name: 'Summer Planting', slug: 'summer-planting', description: `Warm weather ${'plants '.repeat(40)}` });
    const metadata = await seo.getMetadataByPath('/tags/summer-planting?sort=price_asc');
    expect(metadata.title).toBe('Summer Planting');
    expect(metadata.description.length).toBe(160);
    expect(metadata.canonicalUrl).toBe('https://shop.example.test/tags/summer-planting');
    expect(metadata.schemaType).toBe('CollectionPage');
    expect(metadata.noIndex).toBe(false);
    const html = seo.injectMetadataIntoHtml(metadata, '<html><head></head><body><div id="root"></div></body></html>');
    expect(html).toContain('Summer Planting | Store');
    expect(html).toContain('"@type":"CollectionPage"');
  });
  it('uses a useful fallback description and excludes unavailable tags even when SEO overrides exist', async () => {
    vi.spyOn(tags, 'getPublicTagBySlug').mockResolvedValueOnce({ name: 'Summer', slug: 'summer', description: '' }).mockRejectedValue({ statusCode: 404 });
    expect((await seo.getMetadataByPath('/tags/summer')).description).toBe('Browse products tagged Summer.');
    db.SeoOverride.findOne.mockResolvedValue({ metaTitle: 'Internal campaign' });
    await expect(seo.getMetadataByPath('/tags/internal')).rejects.toMatchObject({ statusCode: 404 });
  });
  it('keeps collection metadata when a visible tag has an SEO override', async () => {
    vi.spyOn(tags, 'getPublicTagBySlug').mockResolvedValue({ name: 'Summer', slug: 'summer', description: 'Warm weather' });
    db.SeoOverride.findOne.mockResolvedValue({ metaTitle: 'Summer collection', metaDescription: 'Curated seasonal products' });
    const metadata = await seo.getMetadataByPath('/tags/summer');
    expect(metadata.title).toBe('Summer collection');
    expect(metadata.description).toBe('Curated seasonal products');
    expect(metadata.schemaType).toBe('CollectionPage');
    expect(metadata.canonicalUrl).toBe('https://shop.example.test/tags/summer');
  });
  it('adds only public tag slugs to the sitemap using the configured canonical origin', async () => {
    vi.spyOn(db.Product, 'findAll').mockResolvedValue([]);
    vi.spyOn(db.Category, 'findAll').mockResolvedValue([]);
    vi.spyOn(tags, 'getPublicTags').mockResolvedValue([{ slug: 'summer-planting' }]);
    const xml = await seo.generateSitemap();
    expect(xml).toContain('<loc>https://shop.example.test/tags/summer-planting</loc>');
    expect(xml).not.toContain('/tags/internal');
  });
  it('escapes script boundaries in structured descriptions', () => {
    const description = '</script><script>alert(1)</script>';
    const html = seo.injectMetadataIntoHtml({ ...defaults, title: 'Summer', schemaType: 'CollectionPage', description, canonicalUrl: 'https://shop.example.test/tags/summer' }, '<html><head></head><body></body></html>');
    expect(html).not.toContain('</script><script>');
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
    expect(JSON.parse(json).description).toBe(description);
  });
  it('returns a real 404 and noindex for crawler requests to unavailable tags', async () => {
    vi.spyOn(seo, 'renderHtmlForPath').mockRejectedValue({ statusCode: 404 });
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() };
    const next = vi.fn();
    await crawlerPrerender({ method: 'GET', originalUrl: '/tags/internal', headers: { 'user-agent': 'Googlebot' }, query: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.setHeader).toHaveBeenCalledWith('X-Robots-Tag', 'noindex');
    expect(next).not.toHaveBeenCalled();
  });
});
