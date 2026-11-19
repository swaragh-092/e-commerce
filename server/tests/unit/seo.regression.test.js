import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const seo = require('../../src/modules/seo/seo.service');
const tags = require('../../src/modules/product/tag.service');
const controller = require('../../src/modules/seo/seo.controller');
const featureMiddleware = require('../../src/middleware/featureGate.middleware');
const defaults = {
  siteName: 'Shop', title: 'Seeds', titleSuffix: ' | Shop', description: 'Garden seeds',
  canonicalBaseUrl: 'https://shop.test', currency: 'INR',
};
const graph = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
const template = '<html><head></head><body><div id="root"></div></body></html>';
beforeEach(() => {
  vi.spyOn(seo, '_getGlobalDefaults').mockResolvedValue(defaults);
  vi.spyOn(db.Setting, 'findAll').mockResolvedValue([]);
  vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null);
  vi.spyOn(db.SeoOverride, 'findOne').mockResolvedValue(null);
  vi.spyOn(db.SeoOverride, 'findAll').mockResolvedValue([]);
  for (const model of [db.Product, db.Category, db.Page, db.BlogPost, db.Brand]) {
    vi.spyOn(model, 'findAll').mockResolvedValue([]);
    vi.spyOn(model, 'findOne').mockResolvedValue(null);
  }
  vi.spyOn(tags, 'getPublicTags').mockResolvedValue([]);
  vi.spyOn(featureMiddleware, 'getResolvedFeature').mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe('SEO regression coverage', () => {
  it('reads grouped settings and retains the legacy social image', async () => {
    seo._getGlobalDefaults.mockRestore();
    db.Setting.findAll.mockResolvedValue([
      { group: 'general', key: 'storeName', value: 'Garden Store' },
      { group: 'seo', key: 'ogImage', value: '/uploads/legacy.png' },
      { group: 'seo', key: 'canonicalBaseUrl', value: 'https://garden.test' },
      { group: 'seo', key: 'titleTemplate', value: '%s — Garden' },
    ]);
    expect(await seo._getGlobalDefaults()).toMatchObject({ siteName: 'Garden Store', ogImage: '/uploads/legacy.png', titleTemplate: '%s — Garden' });
  });
  it('uses the page canonical origin for graph identities when no base URL is supplied', () => {
    const nodes = graph(seo.injectMetadataIntoHtml({ title: 'Seeds', siteName: 'Shop', canonicalUrl: 'https://garden.test/products/seeds' }, template));
    expect(nodes.find((node) => node['@type'] === 'WebSite').url).toBe('https://garden.test');
  });
  it.each(['/tags/summer', '/category/flowers', '/p/about'])('emits breadcrumbs with real links at %s', (path) => {
    const nodes = graph(seo.injectMetadataIntoHtml({ ...defaults, title: 'Current page', path, canonicalUrl: `https://shop.test${path}` }, template));
    const crumbs = nodes.find((node) => node['@type'] === 'BreadcrumbList').itemListElement;
    for (const invalidUrl of ['https://shop.test/tags', 'https://shop.test/category', 'https://shop.test/p']) {
      expect(crumbs.map((item) => item.item)).not.toContain(invalidUrl);
    }
    if (path.startsWith('/tags')) expect(crumbs[1].item).toBe('https://shop.test/products');
  });
  it('does not turn utility, unknown, or unavailable entity overrides into sitemap URLs', async () => {
    db.Product.findAll.mockResolvedValue([{ slug: 'visible' }]);
    db.SeoOverride.findAll.mockResolvedValue([
      { path: '/products/visible', noIndex: true },
      { path: '/admin', noIndex: false },
      { path: '/products/draft', noIndex: false },
      { path: '/made-up-route', noIndex: false },
    ]);
    const xml = await seo.generateSitemap();
    for (const path of ['/admin', '/products/visible', '/products/draft', '/made-up-route']) expect(xml).not.toContain(`https://shop.test${path}</loc>`);
    expect(xml).toContain('<loc>https://shop.test/</loc>');
  });
  it('includes only enabled public content types and applies publication filters', async () => {
    db.Setting.findAll.mockResolvedValue(['pages', 'blogs', 'brands'].map((key) => ({ key, value: true })));
    db.Page.findAll.mockResolvedValue([{ slug: 'about' }]);
    db.BlogPost.findAll.mockResolvedValue([{ slug: 'growing-tips' }]);
    db.Brand.findAll.mockResolvedValue([{ slug: 'garden' }]);
    const xml = await seo.generateSitemap();
    for (const path of ['/p/about', '/blogs/growing-tips', '/brands/garden']) expect(xml).toContain(`https://shop.test${path}</loc>`);
    expect(db.Page.findAll.mock.calls[0][0].where.status).toBe('published');
    expect(db.BlogPost.findAll.mock.calls[0][0].where.publishedAt[db.Sequelize.Op.lte]).toBeInstanceOf(Date);
    expect(db.Category.findAll.mock.calls[0][0].include[0].where).toEqual({ status: 'published', isEnabled: true });
    expect(db.Brand.findAll.mock.calls[0][0].where).toEqual({ isActive: true });
  });
  it('applies product overrides after checking public visibility and preserves the product schema', async () => {
    db.SeoOverride.findOne.mockResolvedValue({ metaTitle: 'Better seed title' });
    await expect(seo.getMetadataByPath('/products/draft')).rejects.toMatchObject({ statusCode: 404 });
    db.Product.findOne.mockResolvedValue({ name: 'Seeds', price: 100, quantity: 1 });
    expect(await seo.getMetadataByPath('/products/seeds')).toMatchObject({ title: 'Better seed title', type: 'product', productData: { price: 100 } });
  });
  it.each([
    ['/blogs', 'blogs'], ['/blogs/post', 'blogs'],
    ['/brands', 'brands'], ['/brands/brand', 'brands'], ['/p/about', 'pages'],
  ])('returns 404 for %s when its %s feature is disabled', async (path, feature) => {
    featureMiddleware.getResolvedFeature.mockResolvedValue(false);
    await expect(seo.getMetadataByPath(path)).rejects.toMatchObject({ statusCode: 404 });
    expect(featureMiddleware.getResolvedFeature).toHaveBeenCalledWith(feature);
    expect(db.BlogPost.findOne).not.toHaveBeenCalled();
    expect(db.Page.findOne).not.toHaveBeenCalled();
    expect(db.Brand.findOne).not.toHaveBeenCalled();
  });
  it('returns HTML with a real noindex 404 through the prerender endpoint', async () => {
    vi.spyOn(seo, 'renderHtmlForPath').mockRejectedValue({ statusCode: 404 });
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() };
    const next = vi.fn();
    await controller.prerender({ query: { path: '/products/missing' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.setHeader).toHaveBeenCalledWith('X-Robots-Tag', 'noindex');
    expect(res.send.mock.calls[0][0]).toContain('<meta name="robots" content="noindex,nofollow">');
    expect(next).not.toHaveBeenCalled();
  });
  it('generates a robots sitemap link on the configured public domain', async () => {
    expect(await seo.generateRobots()).toContain('Sitemap: https://shop.test/sitemap.xml');
  });
  it('publishes the active sale price and excludes reserved stock from availability', async () => {
    const metadata = await seo._formatMetadata({ name: 'Seeds', price: 100, salePrice: 80, quantity: 3, reservedQty: 3 }, 'product', '/products/seeds');
    expect(metadata.productData).toMatchObject({ price: 80, availability: 'out of stock' });
    const productSchema = graph(seo.injectMetadataIntoHtml(metadata, template)).find((node) => node['@type'] === 'Product');
    expect(productSchema.offers).toMatchObject({ price: 80, availability: 'https://schema.org/OutOfStock' });
  });
  it('uses the same discount rules for variable products as the storefront', async () => {
    const metadata = await seo._formatMetadata({ name: 'Seeds', price: 100, salePrice: 80, type: 'variable', variants: [
      { sku: 'ONE', price: 120, stockQty: 3, reservedQty: 3, isActive: true },
    ] }, 'product', '/products/seeds');
    expect(metadata.productData).toMatchObject({ price: 100, availability: 'out of stock', variants: [{ price: 100 }] });
  });
  it('honors inactive sale labels in the advertised price', async () => {
    const metadata = await seo._formatMetadata({ name: 'Seeds', price: 100, salePrice: 80, saleLabel: 'inactive', quantity: 1 }, 'product', '/products/seeds', {
      ...defaults, saleLabels: [{ id: 'inactive', isActive: false }],
    });
    expect(metadata.productData.price).toBe(100);
  });
  it('returns generated sitemap XML and robots text with correct content types', async () => {
    const res = { header: vi.fn().mockReturnThis(), send: vi.fn() };
    await controller.getSitemap({ query: {} }, res, vi.fn());
    expect(res.header).toHaveBeenCalledWith('Content-Type', 'application/xml');
    expect(res.send.mock.calls[0][0]).toContain('<loc>https://shop.test/</loc>');
    res.send.mockClear();
    await controller.getRobots({ query: {} }, res, vi.fn());
    expect(res.header).toHaveBeenCalledWith('Content-Type', 'text/plain');
    expect(res.send.mock.calls[0][0]).toContain('Sitemap: https://shop.test/sitemap.xml');
  });
  it('returns a stable error code for a missing metadata path', async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await controller.getMetadata({ query: {} }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toEqual({ code: 'BAD_REQUEST', message: 'Path query parameter is required' });
  });
});
