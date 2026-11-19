'use strict';

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  Product,
  ProductVariant,
  Category,
  Brand,
  BlogPost,
  Page,
  SeoOverride,
  Setting,
  ProductImage,
  Media,
} = require('../index');
const tagService = require('../product/tag.service');
const { buildFeatures } = require('../../config/modes');
const featureGate = require('../../middleware/featureGate.middleware');
const { getEffectivePrice, getVariantUnitPrice, resolveSaleLabel } = require('../product/product.pricing');
const AppError = require('../../utils/AppError');

function escapeHtml(string) {
  if (string == null) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(string) {
  if (string == null) return '';
  return String(string)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const getPublicBaseUrl = (defaults = {}) => {
  for (const candidate of [defaults.canonicalBaseUrl, defaults.canonicalUrl, process.env.CLIENT_URL, 'http://localhost:5173']) {
    const firstCandidate = String(candidate || '').split(',')[0].trim();
    try {
      const url = new URL(firstCandidate);
      if (['http:', 'https:'].includes(url.protocol)) return url.origin;
    } catch (_) { /* Try the next configured base. */ }
  }
  return 'http://localhost:5173';
};

const xmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const toAbsoluteUrl = (baseUrl, pathname) => {
  try {
    return new URL(pathname, `${baseUrl}/`).toString();
  } catch (_) {
    return `${baseUrl}${pathname}`;
  }
};

const formatPageTitle = (title, defaults = {}) => {
  const pageTitle = String(title || defaults.title || defaults.siteName || 'Store').trim();
  if (pageTitle.toLowerCase() === String(defaults.siteName || '').trim().toLowerCase()) return pageTitle;
  const template = String(defaults.titleTemplate || '').trim();
  if (template.includes('%s')) return template.replace(/%s/g, pageTitle);

  const suffix = String(defaults.titleSuffix || '').trim();
  if (suffix) {
    return pageTitle.toLowerCase().endsWith(suffix.toLowerCase()) ? pageTitle : `${pageTitle} ${suffix}`;
  }
  return pageTitle;
};

class SeoService {
  constructor() {
    this._cachedTemplate = null;
  }

  async generateSitemap() {
    const defaults = await this._getGlobalDefaults();
    const clientUrl = getPublicBaseUrl(defaults);
    const featureRows = await Setting.findAll({ where: { group: 'features' } });
    const modeRow = await Setting.findOne({ where: { group: 'general', key: 'mode' } });
    const databaseFeatures = Object.fromEntries(featureRows.map((row) => [row.key, row.value === true || row.value === 'true']));
    const features = buildFeatures(databaseFeatures, modeRow?.value || 'ecommerce');
    const products = await Product.findAll({
      where: { status: 'published', isEnabled: true },
      attributes: ['slug', 'updatedAt']
    });

    const categories = await Category.findAll({
      attributes: ['slug', 'updatedAt'],
      include: [{
        model: Product,
        as: 'products',
        attributes: [],
        through: { attributes: [] },
        where: { status: 'published', isEnabled: true },
        required: true,
      }],
      distinct: true,
    });
    const overrides = await SeoOverride.findAll({ attributes: ['path', 'updatedAt', 'noIndex'] });
    const noIndexPaths = new Set(overrides.filter((item) => item.noIndex).map((item) => item.path));

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages
    const addUrl = (pathname, updatedAt = null, changefreq = 'weekly', priority = '0.5') => {
      if (noIndexPaths.has(pathname)) return;
      xml += `  <url>\n    <loc>${xmlEscape(toAbsoluteUrl(clientUrl, pathname))}</loc>\n`;
      if (updatedAt) {
        const date = new Date(updatedAt);
        if (!Number.isNaN(date.getTime())) xml += `    <lastmod>${date.toISOString()}</lastmod>\n`;
      }
      xml += `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
    };
    addUrl('/', null, 'daily', '1.0');
    addUrl('/products', null, 'daily', '0.8');
    if (features.blogs) addUrl('/blogs', null, 'weekly', '0.6');
    if (features.brands) addUrl('/brands', null, 'weekly', '0.6');

    // Categories
    for (const category of categories) {
      addUrl(`/category/${encodeURIComponent(category.slug)}`, category.updatedAt, 'weekly', '0.7');
    }

    // Products
    for (const product of products) {
      addUrl(`/products/${encodeURIComponent(product.slug)}`, product.updatedAt, 'weekly', '0.6');
    }

    const tags = await tagService.getPublicTags();
    if (tags.length) {
      for (const tag of tags) {
        addUrl(`/tags/${encodeURIComponent(tag.slug)}`, tag.updatedAt, 'weekly', '0.5');
      }
    }

    const pages = features.pages ? await Page.findAll({
      where: { status: 'published' },
      attributes: ['slug', 'updatedAt'],
    }) : [];
    for (const page of pages) addUrl(`/p/${encodeURIComponent(page.slug)}`, page.updatedAt, 'monthly', '0.4');

    const blogPosts = features.blogs ? await BlogPost.findAll({
      where: { status: 'published', publishedAt: { [Op.lte]: new Date() } },
      attributes: ['slug', 'updatedAt', 'publishedAt'],
    }) : [];
    for (const post of blogPosts) addUrl(`/blogs/${encodeURIComponent(post.slug)}`, post.updatedAt || post.publishedAt, 'monthly', '0.5');

    const brands = features.brands ? await Brand.findAll({
      where: { isActive: true },
      attributes: ['slug', 'updatedAt'],
      include: [{
        model: Product,
        as: 'products',
        attributes: [],
        where: { status: 'published', isEnabled: true },
        required: true,
      }],
      distinct: true,
    }) : [];
    for (const brand of brands) addUrl(`/brands/${encodeURIComponent(brand.slug)}`, brand.updatedAt, 'monthly', '0.4');

    // Overrides customize existing routes; they do not create public pages.
    // Their noindex flags above filter the known, published URL candidates.

    xml += `</urlset>`;
    return xml;
  }

  async generateRobots() {
    const clientUrl = getPublicBaseUrl(await this._getGlobalDefaults());
    let robots = `User-agent: *\n`;
    robots += `Allow: /\n`;
    robots += `Disallow: /admin\n`;
    robots += `Disallow: /api\n`;
    robots += `Disallow: /cart\n`;
    robots += `Disallow: /checkout\n`;
    robots += `\nSitemap: ${clientUrl}/sitemap.xml\n`;
    return robots;
  }

  async getMetadataByPath(urlPath) {
    if (typeof urlPath !== 'string' || !urlPath.startsWith('/') || urlPath.startsWith('//')) {
      throw new AppError('VALIDATION_ERROR', 400, 'A local page path is required.');
    }
    const queryIndex = urlPath.indexOf('?');
    const hashIndex = urlPath.indexOf('#');
    const delimiterIndex = [queryIndex, hashIndex].filter((index) => index !== -1).reduce((first, index) => Math.min(first, index), urlPath.length);
    urlPath = urlPath.slice(0, delimiterIndex);
    while (urlPath.length > 1 && urlPath.endsWith('/')) urlPath = urlPath.slice(0, -1);
    // Validate public visibility before resolving overrides for tag URLs.
    let tag = null;
    if (urlPath.startsWith('/tags/')) {
      const tagSlugPath = urlPath.slice('/tags/'.length);
      if (!tagSlugPath || tagSlugPath.includes('/')) throw new AppError('NOT_FOUND', 404, 'Tag not found.');
      let slug;
      try { slug = decodeURIComponent(tagSlugPath); }
      catch (_) { throw new AppError('NOT_FOUND', 404, 'Tag not found.'); }
      tag = await tagService.getPublicTagBySlug(slug);
    }
    // Merge overrides only after resolving a publicly available entity, so an
    // override cannot expose draft content or remove its product/article type.
    const override = await SeoOverride.findOne({ where: { path: urlPath } });
    const overrideData = override && (typeof override.toJSON === 'function' ? override.toJSON() : override);
    const overrides = Object.fromEntries(['metaTitle', 'metaDescription', 'metaKeywords', 'ogImage', 'canonicalUrl', 'noIndex']
      .filter((key) => overrideData?.[key] != null && overrideData[key] !== '')
      .map((key) => [key, overrideData[key]]));
    const formatEntity = (entity, type, pathname, defaults = null) => this._formatMetadata({
      ...(typeof entity.toJSON === 'function' ? entity.toJSON() : entity), ...overrides,
    }, type, pathname, defaults);

    if (tag) return formatEntity(tag, 'tag', `/tags/${encodeURIComponent(tag.slug)}`);

    // 2. Resolve public content metadata used by crawlers before the app loads.
    // Extract slug from common patterns: /products/slug or the legacy /product/slug
    const productMatch = urlPath.match(/^\/products?\/([^/]+)$/);
    const categoryMatch = urlPath.match(/^\/category\/([^/]+)$/);
    const blogMatch = urlPath.match(/^\/blogs\/([^/]+)$/);
    const pageMatch = urlPath.match(/^\/p\/([^/]+)$/);
    const brandMatch = urlPath.match(/^\/brands\/([^/]+)$/);

    if (productMatch) {
      let slug = productMatch[1];
      try {
        slug = decodeURIComponent(slug);
      } catch (e) {
        // Fallback to raw slug if decoding fails
      }
      const product = await Product.findOne({
        where: { slug, status: 'published', isEnabled: true },
        include: [
          {
            model: ProductImage,
            as: 'images',
            attributes: ['url', 'isPrimary', 'sortOrder'],
            required: false,
          },
          {
            model: ProductVariant,
            as: 'variants',
            attributes: ['sku', 'price', 'stockQty', 'reservedQty', 'isActive'],
            where: { isActive: true },
            required: false,
          },
          {
            model: Brand,
            as: 'brand',
            attributes: ['name'],
            required: false,
          },
        ],
      });
      if (product) {
        return formatEntity(product, 'product', `/products/${encodeURIComponent(slug)}`);
      }
      throw new AppError('NOT_FOUND', 404, 'Product not found.');
    }

    if (categoryMatch) {
      let slug = categoryMatch[1];
      try {
        slug = decodeURIComponent(slug);
      } catch (e) {
        // Fallback to raw slug if decoding fails
      }
      const category = await Category.findOne({ where: { slug } });
      if (category) {
        return formatEntity(category, 'category', `/category/${encodeURIComponent(slug)}`);
      }
      throw new AppError('NOT_FOUND', 404, 'Category not found.');
    }

    if (blogMatch) {
      if (!(await featureGate.getResolvedFeature('blogs'))) throw new AppError('NOT_FOUND', 404, 'Blog post not found.');
      let slug;
      try { slug = decodeURIComponent(blogMatch[1]); } catch (_) { slug = blogMatch[1]; }
      const post = await BlogPost.findOne({
        where: { slug, status: 'published', publishedAt: { [Op.lte]: new Date() } },
        include: [{ model: Media, as: 'featuredImage', attributes: ['url'], required: false }],
      });
      if (post) return formatEntity(post, 'blog', `/blogs/${encodeURIComponent(slug)}`);
      throw new AppError('NOT_FOUND', 404, 'Blog post not found.');
    }

    if (pageMatch) {
      if (!(await featureGate.getResolvedFeature('pages'))) throw new AppError('NOT_FOUND', 404, 'Page not found.');
      let slug;
      try { slug = decodeURIComponent(pageMatch[1]); } catch (_) { slug = pageMatch[1]; }
      const page = await Page.findOne({ where: { slug, status: 'published' } });
      if (page) return formatEntity(page, 'page', `/p/${encodeURIComponent(slug)}`);
      throw new AppError('NOT_FOUND', 404, 'Page not found.');
    }

    if (brandMatch) {
      if (!(await featureGate.getResolvedFeature('brands'))) throw new AppError('NOT_FOUND', 404, 'Brand not found.');
      let slug;
      try { slug = decodeURIComponent(brandMatch[1]); } catch (_) { slug = brandMatch[1]; }
      const brand = await Brand.findOne({ where: { slug, isActive: true } });
      if (brand) return formatEntity(brand, 'brand', `/brands/${encodeURIComponent(slug)}`);
      throw new AppError('NOT_FOUND', 404, 'Brand not found.');
    }

    if (urlPath === '/blogs' && !(await featureGate.getResolvedFeature('blogs'))) {
      throw new AppError('NOT_FOUND', 404, 'Blog page not found.');
    }
    if (urlPath === '/brands' && !(await featureGate.getResolvedFeature('brands'))) {
      throw new AppError('NOT_FOUND', 404, 'Brand page not found.');
    }

    const defaults = await this._getGlobalDefaults();
    const listingMetadata = {
      '/': { title: defaults.homeTitle, description: defaults.homeDescription, path: '/' },
      '/products': { title: 'Products', description: 'Browse our products', path: '/products' },
      '/blogs': { title: 'Blogs', description: 'Read the latest stories, updates, and guides from our store.', path: '/blogs' },
      '/brands': { title: 'Brands', description: 'Browse brands available in our store', path: '/brands' },
    }[urlPath];
    if (listingMetadata) {
      return formatEntity({
        metaTitle: listingMetadata.title,
        metaDescription: listingMetadata.description || defaults.description,
        metaKeywords: defaults.keywords,
      }, 'general', listingMetadata.path, defaults);
    }

    if (/^\/(search|cart|checkout|wishlist|account|profile|orders|payment|login|register|forgot-password|reset-password|verify-email)(?:\/|$)|^\/newsletter\/(confirm|unsubscribe)(?:\/|$)/.test(urlPath)) {
      return this._formatMetadata({
        metaTitle: 'Private or utility page',
        metaDescription: defaults.description,
        noIndex: true,
      }, 'utility', urlPath);
    }

    // Unknown SPA routes render the not-found view; keep crawler metadata out
    // of the index instead of presenting the store homepage as a soft 404.
    return this._formatMetadata({
      metaTitle: 'Page not found',
      metaDescription: 'The requested page could not be found.',
      noIndex: true,
    }, 'general', urlPath);
  }

  async _formatMetadata(entity, type = 'general', urlPath = '', defaults = null) {
    defaults = defaults || await this._getGlobalDefaults();
    const baseUrl = getPublicBaseUrl(defaults);

    let description = entity.metaDescription;
    if (!description && type === 'product') {
      description = stripHtml(entity.shortDescription || entity.description || '');
      if (description.length > 160) {
        description = `${description.slice(0, 157)}...`;
      }
    } else if (!description && ['category', 'tag'].includes(type)) {
      description = stripHtml(entity.description || '');
      if (description.length > 160) {
        description = `${description.slice(0, 157)}...`;
      }
    } else if (!description && type === 'brand') {
      description = stripHtml(entity.description || `Shop products from ${entity.name}.`);
      if (description.length > 160) description = `${description.slice(0, 157)}...`;
    } else if (!description && type === 'blog') {
      description = stripHtml(entity.summary || entity.content || '');
      if (description.length > 160) description = `${description.slice(0, 157)}...`;
    } else if (!description && type === 'page') {
      description = stripHtml(entity.content || '');
      if (description.length > 160) description = `${description.slice(0, 157)}...`;
    }
    if (!description) {
      description = type === 'tag' ? `Browse products tagged ${entity.name}.` : defaults.description;
    }

    let ogImage = entity.ogImage;
    if (!ogImage && type === 'product' && Array.isArray(entity.images) && entity.images.length > 0) {
      const primary = entity.images.find((img) => img.isPrimary) || entity.images[0];
      ogImage = primary?.url || null;
    } else if (!ogImage && type === 'category') {
      ogImage = entity.bannerImage || entity.image || null;
    } else if (!ogImage && type === 'blog') {
      ogImage = entity.featuredImage?.url || null;
    } else if (!ogImage && type === 'brand') {
      ogImage = entity.image || null;
    } else if (!ogImage && type === 'page') {
      ogImage = entity.bannerUrl || null;
    }
    if (!ogImage) {
      ogImage = defaults.ogImage;
    }

    // Ensure absolute image URL for external social crawlers (WhatsApp/FB/Twitter)
    if (ogImage && typeof ogImage === 'string' && !ogImage.startsWith('http://') && !ogImage.startsWith('https://')) {
      ogImage = toAbsoluteUrl(baseUrl, ogImage.startsWith('/') ? ogImage : `/${ogImage}`);
    }

    let canonicalUrl = entity.canonicalUrl;
    if (canonicalUrl) {
      try {
        const parsed = new URL(canonicalUrl, `${baseUrl}/`);
        canonicalUrl = ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
      }
      catch (_) { canonicalUrl = ''; }
    }
    if (!canonicalUrl && urlPath) canonicalUrl = toAbsoluteUrl(baseUrl, urlPath);

    const metadata = {
      title: entity.metaTitle || (type === 'category' ? entity.customHeading || entity.name : (['product', 'category', 'tag', 'blog', 'page', 'brand'].includes(type) ? entity.name || entity.title : defaults.title)),
      description,
      keywords: entity.metaKeywords || defaults.keywords,
      ogImage: ogImage || '',
      canonicalUrl: entity.noIndex ? '' : (canonicalUrl || baseUrl),
      noIndex: entity.noIndex || false,
      siteName: defaults.siteName,
      twitterHandle: defaults.twitterHandle,
      titleSuffix: defaults.titleSuffix,
      titleTemplate: defaults.titleTemplate,
      canonicalBaseUrl: defaults.canonicalBaseUrl,
      type: type === 'product' ? 'product' : (type === 'blog' ? 'article' : 'website'),
      path: urlPath,
      pageKind: type,
      ...(type === 'tag' && { schemaType: 'CollectionPage' }),
      ...(type === 'brand' && { schemaType: 'CollectionPage' }),
      ...(type === 'category' && { schemaType: 'CollectionPage' }),
      ...(type === 'page' && { schemaType: 'WebPage' }),
      ...(type === 'blog' && { publishedAt: entity.publishedAt || null }),
    };

    if (type === 'product') {
      const variants = Array.isArray(entity.variants) ? entity.variants.filter((variant) => variant.isActive !== false) : [];
      const pricedEntity = { ...entity, saleLabelResolved: entity.saleLabelResolved || resolveSaleLabel(entity.saleLabel, defaults.saleLabels || []) };
      const available = variants.length
        ? variants.some((variant) => Number(variant.stockQty || 0) - Number(variant.reservedQty || 0) > 0)
        : Number(entity.quantity || 0) - Number(entity.reservedQty || 0) > 0;
      const variantPrices = variants.map((variant) => getVariantUnitPrice(pricedEntity, variant)).filter(Number.isFinite);
      metadata.productData = {
        price: variantPrices.length ? Math.min(...variantPrices) : getEffectivePrice(pricedEntity),
        availability: available ? 'in stock' : 'out of stock',
        currency: defaults.currency || 'INR',
        sku: entity.sku || '',
        name: entity.name || '',
        brand: entity.brand?.name || '',
        variants: variants.map((variant) => ({
          sku: variant.sku || '',
          price: getVariantUnitPrice(pricedEntity, variant),
          availability: Number(variant.stockQty || 0) - Number(variant.reservedQty || 0) > 0 ? 'in stock' : 'out of stock',
        })),
      };
    }

    return metadata;
  }

  async _getGlobalDefaults() {
    const settings = await Setting.findAll({ where: { group: { [Op.in]: ['seo', 'general', 'homepage', 'sales'] } } });

    const settingsMap = {};
    settings.forEach((setting) => (settingsMap[`${setting.group}.${setting.key}`] = setting.value));

    const siteName = settingsMap['seo.siteName'] || settingsMap['general.storeName'] || 'E-Commerce Store';
    let heroSlides = settingsMap['homepage.heroSlides'];
    if (typeof heroSlides === 'string') {
      try { heroSlides = JSON.parse(heroSlides); } catch (_) { heroSlides = []; }
    }
    const homeTitle = settingsMap['homepage.seoTitle'] || settingsMap['seo.defaultTitle'] || 'Best Products Online';
    return {
      siteName,
      title: homeTitle,
      homeTitle,
      homeDescription: settingsMap['homepage.seoDescription'] || heroSlides?.[0]?.subtitle || settingsMap['seo.defaultDescription'] || 'Shop the best products online at our store.',
      titleSuffix: settingsMap['seo.titleSuffix'] || ` | ${siteName}`,
      titleTemplate: settingsMap['seo.titleTemplate'] || '',
      description: settingsMap['seo.defaultDescription'] || 'Shop the best products online at our store.',
      keywords: settingsMap['seo.defaultKeywords'] || 'ecommerce, shop, online',
      ogImage: settingsMap['seo.defaultOgImage'] || settingsMap['seo.ogImage'] || '',
      twitterHandle: settingsMap['seo.twitterHandle'] || '',
      currency: settingsMap['general.currency'] || 'INR',
      saleLabels: Array.isArray(settingsMap['sales.sale_labels']) ? settingsMap['sales.sale_labels'] : [],
      canonicalBaseUrl: settingsMap['seo.canonicalBaseUrl'] || '',
    };
  }

  getHtmlTemplate() {
    if (this._cachedTemplate) {
      return this._cachedTemplate;
    }

    const candidatePaths = [
      path.resolve(__dirname, '../../../../client/dist/index.html'),
      path.resolve(process.cwd(), 'client/dist/index.html'),
      path.resolve(process.cwd(), '../client/dist/index.html'),
      path.resolve(__dirname, '../../../../client/index.html'),
      path.resolve(process.cwd(), 'client/index.html'),
      path.resolve(process.cwd(), '../client/index.html'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf8');
          if (content && content.includes('<html')) {
            if (process.env.NODE_ENV === 'production') {
              this._cachedTemplate = content;
            }
            return content;
          }
        } catch (e) {
          // ignore error and try next candidate
        }
      }
    }

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Store</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
  }

  injectMetadataIntoHtml(metadata, template = null) {
    const rawTemplate = template || this.getHtmlTemplate();
    const rawTitle = metadata.title || metadata.siteName || 'Store';
    const fullTitle = formatPageTitle(rawTitle, metadata);

    const tags = [];

    // Core SEO tags
    tags.push(`<meta name="description" content="${escapeHtml(metadata.description)}" />`);
    if (metadata.keywords) {
      tags.push(`<meta name="keywords" content="${escapeHtml(metadata.keywords)}" />`);
    }
    if (metadata.canonicalUrl) {
      tags.push(`<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}" />`);
    }
    tags.push(`<meta name="robots" content="${metadata.noIndex ? 'noindex, nofollow' : 'index, follow'}" />`);

    // Open Graph
    tags.push(`<meta property="og:site_name" content="${escapeHtml(metadata.siteName)}" />`);
    tags.push(`<meta property="og:title" content="${escapeHtml(fullTitle)}" />`);
    tags.push(`<meta property="og:description" content="${escapeHtml(metadata.description)}" />`);
    tags.push(`<meta property="og:type" content="${escapeHtml(metadata.type || 'website')}" />`);
    if (metadata.canonicalUrl) {
      tags.push(`<meta property="og:url" content="${escapeHtml(metadata.canonicalUrl)}" />`);
    }
    if (metadata.ogImage) {
      tags.push(`<meta property="og:image" content="${escapeHtml(metadata.ogImage)}" />`);
      tags.push(`<meta property="og:image:alt" content="${escapeHtml(rawTitle)}" />`);
    }
    if (metadata.type === 'article' && metadata.publishedAt && !Number.isNaN(new Date(metadata.publishedAt).getTime())) {
      tags.push(`<meta property="article:published_time" content="${escapeHtml(new Date(metadata.publishedAt).toISOString())}" />`);
    }

    // Twitter Card
    tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
    tags.push(`<meta name="twitter:title" content="${escapeHtml(fullTitle)}" />`);
    tags.push(`<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`);
    if (metadata.ogImage) {
      tags.push(`<meta name="twitter:image" content="${escapeHtml(metadata.ogImage)}" />`);
    }
    if (metadata.twitterHandle) {
      tags.push(`<meta name="twitter:site" content="${escapeHtml(metadata.twitterHandle)}" />`);
    }

    // Product rich tags for WhatsApp / FB Product Catalog / Google
    if (metadata.type === 'product' && metadata.productData) {
      if (metadata.productData.price != null) {
        tags.push(`<meta property="product:price:amount" content="${escapeHtml(metadata.productData.price)}" />`);
      }
      if (metadata.productData.currency) {
        tags.push(`<meta property="product:price:currency" content="${escapeHtml(metadata.productData.currency)}" />`);
      }
      if (metadata.productData.availability) {
        tags.push(`<meta property="product:availability" content="${escapeHtml(metadata.productData.availability)}" />`);
      }
    }

    // Schema.org JSON-LD
    let pageSchema = null;
    if (metadata.type === 'product' && metadata.productData) {
      const variants = metadata.productData.variants || [];
      pageSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': `${metadata.canonicalUrl}#product`,
        name: metadata.productData.name || rawTitle,
        description: metadata.description,
        image: metadata.ogImage ? [metadata.ogImage] : [],
        ...(metadata.productData.sku ? { sku: metadata.productData.sku } : {}),
        ...(metadata.productData.brand ? { brand: { '@type': 'Brand', name: metadata.productData.brand } } : {}),
        offers: {
          '@type': 'Offer',
          price: metadata.productData.price,
          priceCurrency: metadata.productData.currency,
          availability: metadata.productData.availability === 'in stock'
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: metadata.canonicalUrl,
        },
      };
      if (variants.length) {
        pageSchema = {
          '@context': 'https://schema.org',
          '@type': 'ProductGroup',
          '@id': `${metadata.canonicalUrl}#product-group`,
          name: metadata.productData.name || rawTitle,
          description: metadata.description,
          ...(metadata.productData.sku ? { productGroupID: metadata.productData.sku } : {}),
          ...(metadata.productData.brand ? { brand: { '@type': 'Brand', name: metadata.productData.brand } } : {}),
          ...(metadata.ogImage ? { image: [metadata.ogImage] } : {}),
          hasVariant: variants.map((variant) => ({
            '@type': 'Product',
            name: metadata.productData.name || rawTitle,
            ...(variant.sku ? { sku: variant.sku } : {}),
            offers: {
              '@type': 'Offer',
              price: variant.price,
              priceCurrency: metadata.productData.currency,
              availability: variant.availability === 'in stock' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              url: metadata.canonicalUrl,
            },
          })),
        };
      }
    } else if (metadata.schemaType === 'CollectionPage') {
      pageSchema = {
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: rawTitle, description: metadata.description, url: metadata.canonicalUrl,
      };
    } else if (metadata.type === 'article') {
      pageSchema = {
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: rawTitle,
        description: metadata.description,
        ...(metadata.ogImage ? { image: [metadata.ogImage] } : {}),
        ...(metadata.publishedAt ? { datePublished: metadata.publishedAt } : {}),
        mainEntityOfPage: metadata.canonicalUrl,
      };
    } else {
      pageSchema = {
        '@context': 'https://schema.org',
        '@type': metadata.schemaType || 'WebPage',
        name: rawTitle,
        url: metadata.canonicalUrl,
        description: metadata.description,
      };
    }
    const websiteSchema = {
      '@type': 'WebSite',
      '@id': `${getPublicBaseUrl(metadata)}#website`,
      name: metadata.siteName,
      url: getPublicBaseUrl(metadata),
    };
    const organizationSchema = {
      '@type': 'OnlineStore',
      '@id': `${getPublicBaseUrl(metadata)}#organization`,
      name: metadata.siteName,
      url: getPublicBaseUrl(metadata),
    };
    const schemaGraphItems = [websiteSchema, organizationSchema, pageSchema];
    const pathSegments = metadata.path?.split('/').filter(Boolean) || [];
    const collectionCrumb = {
      products: { name: 'Products', path: '/products' },
      product: { name: 'Products', path: '/products' },
      tags: { name: 'Products', path: '/products' },
      blogs: { name: 'Blogs', path: '/blogs' },
      brands: { name: 'Brands', path: '/brands' },
    }[pathSegments[0]];
    if (pathSegments.length > 1 && metadata.canonicalUrl) {
      const baseUrl = getPublicBaseUrl(metadata);
      const crumbs = [{ name: 'Home', item: `${baseUrl}/` }];
      if (collectionCrumb) crumbs.push({ name: collectionCrumb.name, item: `${baseUrl}${collectionCrumb.path}` });
      crumbs.push({ name: rawTitle, item: metadata.canonicalUrl });
      schemaGraphItems.push({
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb })),
      });
    }
    const schemaGraph = { '@context': 'https://schema.org', '@graph': schemaGraphItems };
    tags.push(`<script type="application/ld+json">${JSON.stringify(schemaGraph).replace(/</g, '\\u003c')}</script>`);

    const injectedMeta = '\n    ' + tags.join('\n    ') + '\n  ';

    let html = rawTemplate;

    // Replace or insert <title>
    if (/<title>[\s\S]*?<\/title>/i.test(html)) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(fullTitle)}</title>`);
    } else {
      html = html.replace(/<\/head>/i, `  <title>${escapeHtml(fullTitle)}</title>\n</head>`);
    }

    // Strip default placeholder meta description if present
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');

    // Insert all meta tags before </head>
    html = html.replace(/<\/head>/i, `${injectedMeta}</head>`);

    // Add semantic noscript preview inside #root for crawlers that don't execute JS
    const noscriptContent = `<noscript><div style="padding:20px;font-family:sans-serif;"><h1>${escapeHtml(fullTitle)}</h1><p>${escapeHtml(metadata.description)}</p>${metadata.ogImage ? `<p><img src="${escapeHtml(metadata.ogImage)}" alt="${escapeHtml(rawTitle)}" style="max-width:320px;" /></p>` : ''}${metadata.productData ? `<p>Price: ${escapeHtml(metadata.productData.currency)} ${escapeHtml(metadata.productData.price)} &middot; Status: ${escapeHtml(metadata.productData.availability)}</p>` : ''}</div></noscript>`;

    if (html.includes('<div id="root"></div>')) {
      html = html.replace('<div id="root"></div>', `<div id="root">${noscriptContent}</div>`);
    } else {
      const rootPos = html.indexOf('id="root"');
      if (rootPos !== -1) {
        const openEnd = html.indexOf('>', rootPos);
        if (openEnd !== -1) {
          const closePos = html.indexOf('</div>', openEnd);
          if (closePos !== -1) {
            html = html.slice(0, openEnd + 1) + noscriptContent + html.slice(closePos);
          }
        }
      }
    }

    return html;
  }

  async renderHtmlForPath(urlPath = '/') {
    let cleanPath = '/';
    try {
      const parsed = new URL(String(urlPath || '/'), 'http://localhost');
      cleanPath = parsed.pathname;
    } catch {
      cleanPath = '/';
    }
    const metadata = await this.getMetadataByPath(cleanPath);
    return this.injectMetadataIntoHtml(metadata);
  }
}

module.exports = new SeoService();
