import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const categoryService = require('../../src/modules/category/category.service');
const settings = require('../../src/modules/settings/settings.service');
const featureGate = require('../../src/middleware/featureGate.middleware');
const root = '/demo-orbis-seeds-v1-html';
let router;
let api;

function response() {
  const res = { headers: {}, statusCode: 200 };
  res.set = (key, value) => { res.headers[key] = value; return res; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.type = (type) => res.set('Content-Type', type);
  res.json = res.send = (body) => { res.body = body; return res; };
  return res;
}

async function get(target) {
  const path = target.split('?')[0];
  const layer = router.stack.find((entry) => entry.route && entry.match(path));
  const res = response();
  await layer.route.stack[0].handle({ path, url: target }, res, (error) => { if (error) throw error; });
  return res;
}

beforeEach(() => {
  vi.stubEnv('ORBI_STOREFRONT_URL', 'https://seeds.test/store/');
  vi.stubEnv('ORBI_API_ORIGIN', 'https://backend.test');
  vi.spyOn(db.Setting, 'findAll').mockResolvedValue([]);
  vi.spyOn(db.SeoOverride, 'findAll').mockResolvedValue([]);
  vi.spyOn(db.Product, 'findOne').mockResolvedValue(null);
  vi.spyOn(db.Product, 'findAll').mockResolvedValue([]);
  vi.spyOn(db.Page, 'findOne').mockResolvedValue(null);
  vi.spyOn(db.Page, 'findAll').mockResolvedValue([]);
  vi.spyOn(db.BlogPost, 'findOne').mockResolvedValue(null);
  vi.spyOn(db.BlogPost, 'findAll').mockResolvedValue([]);
  vi.spyOn(db.Gallery, 'findAll').mockResolvedValue([]);
  vi.spyOn(categoryService, 'getCategoryTree').mockResolvedValue([]);
  vi.spyOn(settings, 'getFeatures').mockResolvedValue({ features: { pricing: true, showPrice: true } });
  vi.spyOn(featureGate, 'getResolvedFeature').mockResolvedValue(true);
  const { mountOrbiStorefront } = require('../../src/modules/seo/orbiStorefront');
  mountOrbiStorefront({
    use: (path, handler) => { if (path === root) router = handler; },
    get: (_, handler) => { api = handler; },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Orbi storefront SEO', () => {
  it('renders saved SEO fields and image alt in the initial product HTML', async () => {
    db.Product.findOne.mockResolvedValue({
      name: 'Dwarf tomato', metaTitle: 'Dwarf tomato seeds', metaDescription: 'Compact tomato plants',
      images: [{ isPrimary: true, media: { url: '/uploads/tomato.jpg', alt: 'Tomatoes on a vine' } }],
      price: 25, quantity: 2,
    });
    db.SeoOverride.findAll.mockResolvedValue([
      { path: '/products/tomato', metaTitle: 'Shared title' },
      { path: '/products.html?slug=tomato', metaTitle: 'Unprefixed title' },
      { path: '/store/products.html?slug=tomato', metaTitle: 'Tomato seeds $&' },
    ]);
    const res = await get('/products.html?category=vegetables&slug=tomato&variant=packet&utm_source=mail');
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>Tomato seeds $&amp; | Orbi Seeds</title>');
    expect(res.body).toContain('href="https://seeds.test/store/products.html?slug=tomato"');
    expect(res.body).toContain('property="og:image" content="https://backend.test/uploads/tomato.jpg"');
    expect(res.body).toContain('property="og:image:alt" content="Tomatoes on a vine"');
    expect(res.body).toContain('"@type":"Product"');
    expect(res.body).toContain('"price":25');
    expect(res.body.match(/name="description"/g)).toHaveLength(1);

    settings.getFeatures.mockResolvedValue({ features: { showPrice: false } });
    const hidden = await get('/products.html?slug=tomato');
    expect(hidden.body).not.toContain('"offers"');
    expect(hidden.body).not.toContain('product:price:amount');
  });

  it('uses the same canonical rules for server HTML and browser navigation metadata', async () => {
    categoryService.getCategoryTree.mockResolvedValue([{ name: 'Vegetables', slug: 'vegetables', children: [
      { name: 'Tomato', slug: 'tomato', children: [], metaTitle: 'Tomato varieties', metaDescription: 'Browse tomato varieties', ogImage: '/uploads/tomato.jpg' },
    ] }]);
    const res = response();
    await api({ query: { path: '/products.html?cat=tomato&page=2&gclid=example' } }, res, (error) => { throw error; });
    expect(res.body.data.tags).toContain('href="https://seeds.test/store/products.html?category=tomato&amp;page=2"');
    expect(res.body.data.title).toBe('Tomato varieties | Orbi Seeds');
    expect(res.body.data.tags).toContain('content="Browse tomato varieties"');
    expect(res.body.data.tags).toContain('content="https://backend.test/uploads/tomato.jpg"');
    const filtered = await get('/products.html?category=tomato&q=red');
    expect(filtered.headers['X-Robots-Tag']).toContain('noindex');
    expect(filtered.body).not.toContain('rel="canonical"');

    db.Gallery.findAll.mockResolvedValue([{ toJSON: () => ({
      title: 'Trials', slug: 'trials', description: 'Field photographs',
      coverImage: { url: '/uploads/trial.jpg', alt: 'Rows of trial plants' },
    }) }]);
    const album = await get('/gallery.html?album=trials');
    expect(album.body).toContain('href="https://seeds.test/store/gallery-detail.html?album=trials"');
    expect(album.body).toContain('"@type":"ImageGallery"');
    expect(album.body).toContain('content="Rows of trial plants"');
  });

  it('renders public article metadata and keeps the visible headline in structured data', async () => {
    db.BlogPost.findOne.mockResolvedValue({
      title: 'Growing tomatoes', metaTitle: 'Guide to growing tomatoes', summary: 'A growing guide',
      publishedAt: new Date('2026-06-01'), updatedAt: new Date('2026-06-02'),
      featuredImage: { url: '/uploads/guide.jpg', alt: 'Seedlings in growing trays' },
    });
    const res = await get('/resource.html?slug=growing-tomatoes');
    expect(res.body).toContain('href="https://seeds.test/store/resource.html?slug=growing-tomatoes"');
    expect(res.body).toContain('content="Guide to growing tomatoes | Orbi Seeds"');
    expect(res.body).toContain('"headline":"Growing tomatoes"');
    expect(res.body).toContain('"dateModified":"2026-06-02T00:00:00.000Z"');
    expect(res.body).toContain('property="og:image:alt" content="Seedlings in growing trays"');
    expect(db.BlogPost.findOne.mock.calls[0][0].where.status).toBe('published');
  });

  it('serves unavailable entities and utility URLs with the correct indexing status', async () => {
    db.SeoOverride.findAll.mockResolvedValue([{ path: '/products/draft', metaTitle: 'Draft product' }]);
    for (const path of ['/products.html?slug=draft', '/gallery-detail.html?album=absent', '/missing.html']) {
      const res = await get(path);
      expect(res.statusCode).toBe(404);
      expect(res.headers['X-Robots-Tag']).toContain('noindex');
      expect(res.body).not.toContain('Draft product');
    }
    const confirmation = await get('/thank-you.html?token=example');
    expect(confirmation.statusCode).toBe(200);
    expect(confirmation.headers['X-Robots-Tag']).toContain('noindex');
    expect(confirmation.body).not.toContain('rel="canonical"');
  });

  it('renders published CMS content, SEO fields, and public links from the sitemap', async () => {
    const page = {
      title: 'About our policies', slug: 'policies', metaTitle: 'Policies for growers', metaDescription: 'Read about our policies',
      bannerUrl: '/uploads/growers.jpg',
      content: '<h1>Delivery</h1><p>Delivery details</p><img src="/uploads/fields.jpg" alt="Seed farm"><script>abc()</script>',
    };
    db.Page.findOne.mockResolvedValue(page);
    db.Page.findAll.mockResolvedValue([page]);
    const res = await get('/page.html?slug=policies');
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<h1>About our policies</h1>');
    expect(res.body).toContain('<h2>Delivery</h2>');
    expect(res.body).toContain('<title>Policies for growers | Orbi Seeds</title>');
    expect(res.body).toContain('content="Read about our policies"');
    expect(res.body).toContain('content="https://backend.test/uploads/growers.jpg"');
    expect(res.body).toContain('href="https://seeds.test/store/page.html?slug=policies"');
    expect(res.body).toContain('<img alt="Seed farm" src="https://backend.test/uploads/fields.jpg"');
    expect(res.body).not.toContain('abc()');
    expect(db.Page.findOne.mock.calls[0][0].where).toEqual({ slug: 'policies', status: 'published' });
    expect((await get('/sitemap.html')).body).toContain('<a href="page.html?slug=policies">About our policies</a>');
    expect((await get('/sitemap.xml')).body).toContain('https://seeds.test/store/page.html?slug=policies');

    db.SeoOverride.findAll.mockResolvedValue([{ path: '/p/policies', noIndex: true }]);
    expect((await get('/page.html?slug=policies')).headers['X-Robots-Tag']).toContain('noindex');
    expect((await get('/sitemap.xml')).body).not.toContain('page.html?slug=policies');

    db.Page.findOne.mockResolvedValue(null);
    expect((await get('/page.html?slug=draft')).statusCode).toBe(404);
    featureGate.getResolvedFeature.mockImplementation(async (feature) => feature !== 'pages');
    expect((await get('/page.html?slug=policies')).statusCode).toBe(404);
    expect((await get('/sitemap.xml')).body).not.toContain('page.html?slug=policies');
  });

  it('applies a prefixed override to both the storefront response and XML sitemap', async () => {
    const target = '/store/contact-us.html';
    db.SeoOverride.findAll.mockResolvedValue([
      { path: '/contact-us.html', metaTitle: 'General contact' },
      { path: target, metaTitle: 'Grower contacts', metaKeywords: 'growers, contacts', ogImage: '/uploads/contact.jpg', canonicalUrl: '/store/about-orbis.html' },
    ]);
    const res = await get('/contact-us.html');
    expect(res.body).toContain('<title>Grower contacts | Orbi Seeds</title>');
    expect(res.body).toContain('content="growers, contacts"');
    expect(res.body).toContain('content="https://backend.test/uploads/contact.jpg"');
    expect(res.body).toContain('href="https://seeds.test/store/about-orbis.html"');
    expect((await get('/sitemap.xml')).body).not.toContain(target);
  });

  it('publishes storefront URLs and omits disabled and noncanonical entries from the sitemap', async () => {
    db.Product.findAll.mockResolvedValue([{ slug: 'visible' }, { slug: 'hidden' }, { slug: 'duplicate' }]);
    db.BlogPost.findAll.mockResolvedValue([{ slug: 'growing' }]);
    db.Gallery.findAll.mockResolvedValue([{ slug: 'field-trials' }]);
    db.SeoOverride.findAll.mockResolvedValue([
      { path: '/products/hidden', noIndex: true },
      { path: '/products.html?slug=duplicate', canonicalUrl: 'https://seeds.test/store/products.html?slug=visible' },
    ]);
    const { body } = await get('/sitemap.xml');
    expect(body).toContain('https://seeds.test/store/products.html?slug=visible');
    expect(body).toContain('https://seeds.test/store/resource.html?slug=growing');
    expect(body).toContain('https://seeds.test/store/gallery-detail.html?album=field-trials');
    expect(body).not.toMatch(/hidden|duplicate|wishlist|thank-you|backend\.test/);
    expect(db.Product.findAll.mock.calls[0][0].where).toEqual({ status: 'published', isEnabled: true });
    expect(db.Gallery.findAll.mock.calls[0][0].where).toEqual({ isActive: true, isShowcase: true });
    expect((await get('/robots.txt')).body).toContain('Sitemap: https://seeds.test/store/sitemap.xml');
  });
});
