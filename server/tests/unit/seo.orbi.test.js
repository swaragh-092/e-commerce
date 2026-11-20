import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const categoryService = require('../../src/modules/category/category.service');
const settings = require('../../src/modules/settings/settings.service');
const featureGate = require('../../src/middleware/featureGate.middleware');
const root = '/demo-orbis-seeds-v1-html';
const { resolve: resolveRoute } = require('../../../demo-orbis-seeds-v1-html/js/seo-routes');
const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll("'", '&#39;');
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
  it.each([
    '/index.html', '/about-orbis.html', '/product.html?cat=fruit', '/product.html?cat=vegetables',
    '/product.html?cat=flowers', '/research-and-development.html', '/partners.html', '/resources.html',
    '/gallery.html', '/gallery-detail.html?album=vegetables', '/gallery-detail.html?album=flower',
    '/gallery-detail.html?album=fresh-fruits', '/contact-us.html',
  ])('renders the approved default verbatim at %s', async (target) => {
    db.Setting.findAll.mockResolvedValue([
      { group: 'homepage', key: 'seoTitle', value: 'Old home title' },
      { group: 'homepage', key: 'seoDescription', value: 'Old home description' },
      { group: 'seo', key: 'titleTemplate', value: 'Template: %s' },
    ]);
    categoryService.getCategoryTree.mockResolvedValue(['fruit', 'vegetables', 'flowers'].map((slug) => ({
      slug, name: slug, metaTitle: '', metaDescription: null,
      children: [{ slug: slug + '-child', children: [] }],
    })));
    db.Gallery.findAll.mockImplementation(async ({ where }) => [{
      toJSON: () => ({ slug: where.slug, title: 'Saved album title', description: 'Saved album description' }),
    }]);

    const url = new URL(target, 'https://seeds.test');
    const { approvedCopy } = resolveRoute(url.pathname.slice(1), url.searchParams);
    const res = await get(target);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(`<title>${escapeHtml(approvedCopy.metaTitle)}</title>`);
    expect(res.body).toContain(`name="description" content="${escapeHtml(approvedCopy.metaDescription)}"`);
    expect(res.body).toContain(`property="og:title" content="${escapeHtml(approvedCopy.metaTitle)}"`);
  });

  it('uses saved category SEO before the approved copy and applies overrides per field', async () => {
    const category = {
      name: 'Flowers', slug: 'flowers', metaTitle: 'Flower Research | Quality Flower Seeds', metaDescription: '   ',
      children: [{ slug: 'marigold', children: [] }],
    };
    categoryService.getCategoryTree.mockResolvedValue([category]);
    const path = '/product.html?cat=flowers';
    const defaults = await get(path);
    expect(defaults.body).toContain('<title>Flower Research | Quality Flower Seeds</title>');
    expect(defaults.body).toContain('name="description" content="Explore quality flower seeds from Orbi Seeds,');

    category.metaDescription = 'Saved description from Edit Category';
    db.SeoOverride.findAll.mockResolvedValue([{ path, metaTitle: 'Campaign flowers' }]);
    const override = await get(path);
    expect(override.body).toContain('<title>Campaign flowers | Orbi Seeds</title>');
    expect(override.body).toContain('name="description" content="Saved description from Edit Category"');
  });

  it('allows an explicit SEO override to replace part of the approved copy', async () => {
    db.SeoOverride.findAll.mockResolvedValue([
      { path: '/store/gallery.html', metaDescription: 'Temporary exhibition' },
    ]);
    const res = await get('/gallery.html');
    expect(res.body).toContain('<title>Agricultural &amp; Seed Gallery | Orbi Seeds International Pvt. Ltd.</title>');
    expect(res.body).toContain('name="description" content="Temporary exhibition"');
  });

  it('renders saved SEO fields and image alt in the initial product HTML', async () => {
    db.Product.findOne.mockResolvedValue({
      name: 'Dwarf tomato', metaTitle: 'Dwarf tomato seeds', metaDescription: 'Compact tomato plants',
      images: [{ isPrimary: true, alt: 'tomato.jpg', media: { url: '/uploads/tomato.jpg', alt: 'Tomatoes on a vine' } }],
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

  it('uses Store Identity on category pages with legacy SEO branding', async () => {
    db.Setting.findAll.mockResolvedValue([
      { group: 'general', key: 'storeName', value: 'ORBI SEEDS' },
      { group: 'seo', key: 'siteName', value: 'My Store' },
      { group: 'seo', key: 'titleTemplate', value: '%s | My Store' },
      { group: 'seo', key: 'titleSuffix', value: ' | My Store' },
    ]);
    categoryService.getCategoryTree.mockResolvedValue([
      { name: 'Marigold', slug: 'marigold', metaTitle: 'Marigold Seeds | Hybrid & High Yield', children: [] },
    ]);

    const path = '/products.html?category=marigold';
    const title = 'Marigold Seeds | Hybrid & High Yield | ORBI SEEDS';
    const html = await get(path);
    expect(html.body).toContain(`<title>${escapeHtml(title)}</title>`);

    const res = response();
    await api({ query: { path } }, res, (error) => { throw error; });
    expect(res.body.data.title).toBe(title);
    expect(res.body.data.tags).toContain('property="og:site_name" content="ORBI SEEDS"');
    expect(res.body.data.tags).not.toContain('My Store');
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
    expect(res.body).toContain('id="cms-page-title">About our policies</h1>');
    expect(res.body).toContain('id="cms-page-breadcrumb" aria-current="page">About our policies</span>');
    expect(res.body).toContain('class="cms-banner-image" src="https://backend.test/uploads/growers.jpg"');
    expect(res.body).toContain('<div data-orbi-cms-rendered>');
    expect(res.body).toContain('class="nav-links"');
    expect(res.body).toContain('data-orbi-footer-menu="quick_links"');
    expect(res.body).toContain('data-orbi-footer-menu="footer_column"');
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

 it('uses saved gallery SEO ahead of approved fallback copy', async () => {
    db.Gallery.findAll.mockResolvedValue([{ toJSON: () => ({ title: 'Vegetables', slug: 'vegetables', metaTitle: 'Merchant album title', metaDescription: 'Merchant album description', metaKeywords: 'custom vegetables', ogImage: '/uploads/custom-album.jpg', items: [] }) }]);
    const res = await get('/gallery-detail.html?album=vegetables');
    expect(res.body).toContain('Merchant album title');
    expect(res.body).toContain('Merchant album description');
    expect(res.body).toContain('https://backend.test/uploads/custom-album.jpg');
    expect(db.Gallery.findAll.mock.calls[0][0].attributes).toEqual(expect.arrayContaining(['metaTitle', 'metaDescription', 'metaKeywords', 'ogImage']));
  });
