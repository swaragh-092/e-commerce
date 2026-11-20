'use strict';

const express = require('express');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { Op } = require('sequelize');
const { BlogPost, Gallery, Product, SeoOverride } = require('../index');
const categoryService = require('../category/category.service');
const settings = require('../settings/settings.service');
const galleries = require('../gallery/gallery.service');
const { getResolvedFeature } = require('../../middleware/featureGate.middleware');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');
const { isBrandVisible } = require('../../utils/brandVisibility');
const seo = require('./seo.service');
const { pages, siteName, pagePath, resolve } = require('../../../../demo-orbis-seeds-v1-html/js/seo-routes');

const directory = path.resolve(__dirname, '../../../../demo-orbis-seeds-v1-html');
const mount = '/demo-orbis-seeds-v1-html';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const flatten = (tree) => tree.flatMap((node) => [node, ...flatten(node.children)]);
const categoryPath = (category) => category.children.length
  ? pagePath('product.html', { cat: category.slug })
  : pagePath('products.html', { category: category.slug });

function configuredUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Orbi storefront configuration requires an HTTP(S) URL without credentials, query or fragment.');
  }
  return url;
}

function mountOrbiStorefront(app) {
  if (!process.env.ORBI_STOREFRONT_URL) return;
  const publicUrl = configuredUrl(process.env.ORBI_STOREFRONT_URL.replace(/\/*$/, '/'));
  const apiOrigin = process.env.ORBI_API_ORIGIN ? configuredUrl(process.env.ORBI_API_ORIGIN).origin : publicUrl.origin;
  const absolute = (relative) => new URL(relative, publicUrl).href;
  const router = express.Router();

  function fallback(route) {
    const [title, description, image, schemaType] = pages[route.missing ? 'error.html' : route.file];
    return {
      title, description, ogImage: image ? absolute('images/' + image) : '', schemaType,
      siteName, siteUrl: publicUrl.href, titleSuffix: ' | Orbi Seeds', organizationType: 'Organization',
      canonicalBaseUrl: publicUrl.origin, noIndex: route.noIndex,
      canonicalUrl: route.noIndex ? '' : absolute(route.publicPath),
    };
  }

  async function metadata(route) {
    let entity;
    let publicPath = route.publicPath;
    if (route.missing || ['wishlist.html', 'enquiry-list.html', 'thank-you.html'].includes(route.file)) return fallback(route);

    const fallbackData = fallback(route);
    const global = await seo._getGlobalDefaults({
      siteName, title: fallbackData.title, description: fallbackData.description,
      keywords: '', titleSuffix: ' | Orbi Seeds',
    });
    const defaults = {
      ...global, canonicalBaseUrl: publicUrl.origin, siteUrl: publicUrl.href, organizationType: 'Organization',
      mediaBaseUrl: apiOrigin, ogImage: global.ogImage || fallbackData.ogImage,
      ogImageAlt: global.ogImage ? '' : siteName,
    };
    if (route.kind === 'category') {
      entity = flatten(await categoryService.getCategoryTree({ hideEmpty: true })).find((category) => category.slug === route.slug);
      if (!entity) return null;
      publicPath = categoryPath(entity) + (route.page ? '&page=' + route.page : '');
    } else if (route.kind === 'gallery') {
      if (!(await getResolvedFeature('gallery'))) return null;
      [entity] = await galleries.listPublic(route.slug);
      if (!entity) return null;
    } else if (route.kind === 'general') {
      const enabled = { 'resources.html': 'blogs', 'gallery.html': 'gallery' }[route.file];
      if (enabled && !(await getResolvedFeature(enabled))) return null;
      entity = {
        metaTitle: route.file === 'index.html' ? global.homeTitle : fallbackData.title,
        metaDescription: route.file === 'index.html' ? global.homeDescription : fallbackData.description,
        schemaType: fallbackData.schemaType,
      };
    }

    const collection = {
      product: ['Seed Catalogue', 'products.html'], category: ['Seed Categories', 'product.html'],
      blog: ['Agricultural Resources', 'resources.html'], gallery: ['Photo Gallery', 'gallery.html'],
    }[route.kind];
    const canonical = new URL(publicPath, publicUrl);
    const data = await seo.getMetadataByPath(route.key, {
      defaults, entity, kind: route.kind, noIndex: route.noIndex,
      publicPath: canonical.pathname + canonical.search,
      overridePath: '/' + publicPath.split(/[&?]page=/)[0],
    });
    if (data.productData) {
      const { features } = await settings.getFeatures();
      if (!isBrandVisible(features)) data.productData.brand = '';
      if (features.pricing === false || features.showPrice === false) {
        data.productData.price = null;
        for (const variant of data.productData.variants) variant.price = null;
      }
    }
    if (data.canonicalUrl && collection) {
      const [name, href] = collection;
      data.breadcrumbs = [
        { name: 'Home', item: publicUrl.href },
        { name, item: absolute(href) },
        { name: data.productData?.name || entity?.name || entity?.title || data.title, item: data.canonicalUrl },
      ];
    }
    return data;
  }

  async function getPageMetadata(route) {
    try {
      return await metadata(route);
    } catch (err) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  }

  app.get('/api/seo/orbi/metadata', async (req, res, next) => {
    const target = req.query.path;
    if (typeof target !== 'string' || !/^\/[a-z0-9.-]*(?:\?.*)?$/.test(target) || target.length > 2048) {
      return error(res, 'A storefront page path is required', 400, 'VALIDATION_ERROR');
    }
    const parsed = new URL(target, 'http://localhost');
    try {
      const route = resolve(parsed.pathname.slice(1) || 'index.html', parsed.searchParams);
      const data = await getPageMetadata(route);
      if (!data || route.missing) return error(res, 'Page not found', 404, 'NOT_FOUND');
      return success(res, seo.buildHead(data));
    } catch (err) {
      return next(err);
    }
  });

  router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /api/\nDisallow: /admin/\n\nSitemap: ' + absolute('sitemap.xml') + '\n');
  });

  router.get('/sitemap.xml', async (req, res, next) => {
    try {
      const [blogsEnabled, galleriesEnabled] = await Promise.all([getResolvedFeature('blogs'), getResolvedFeature('gallery')]);
      const [products, categories, posts, albums, overrides] = await Promise.all([
        Product.findAll({ where: { status: 'published', isEnabled: true }, attributes: ['slug', 'updatedAt'] }),
        categoryService.getCategoryTree({ hideEmpty: true }),
        blogsEnabled ? BlogPost.findAll({ where: { status: 'published', publishedAt: { [Op.lte]: new Date() } }, attributes: ['slug', 'updatedAt'] }) : [],
        galleriesEnabled ? Gallery.findAll({ where: { isActive: true, isShowcase: true }, attributes: ['slug', 'updatedAt'] }) : [],
        SeoOverride.findAll({ attributes: ['path', 'noIndex', 'canonicalUrl'] }),
      ]);
      const byPath = new Map(overrides.map((row) => [row.path, row]));
      const entries = new Map();
      function add(relative, key, updatedAt) {
        const override = byPath.get('/' + relative) || byPath.get(key);
        const loc = absolute(relative);
        if (override?.noIndex) return;
        if (override?.canonicalUrl) {
          try {
            const canonical = new URL(override.canonicalUrl, publicUrl.origin);
            if (['http:', 'https:'].includes(canonical.protocol) && canonical.href !== loc) return;
          } catch { /* Invalid overrides fall back to the storefront URL. */ }
        }
        const date = updatedAt && new Date(updatedAt);
        entries.set(loc, date && !Number.isNaN(date.getTime()) ? date.toISOString() : '');
      }
      for (const file of Object.keys(pages)) {
        if ((file === 'resources.html' && !blogsEnabled) || (file === 'gallery.html' && !galleriesEnabled)) continue;
        const route = resolve(file, new URLSearchParams());
        if (!route.noIndex) add(route.publicPath, route.key);
      }
      for (const category of flatten(categories)) add(categoryPath(category), '/category/' + encodeURIComponent(category.slug), category.updatedAt);
      for (const product of products) add(pagePath('products.html', { slug: product.slug }), '/products/' + encodeURIComponent(product.slug), product.updatedAt);
      for (const post of posts) add(pagePath('resource.html', { slug: post.slug }), '/blogs/' + encodeURIComponent(post.slug), post.updatedAt);
      for (const album of albums) add(pagePath('gallery-detail.html', { album: album.slug }), '/gallery/' + encodeURIComponent(album.slug), album.updatedAt);
      const urls = Array.from(entries, ([loc, date]) => `  <url><loc>${escape(loc)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`);
      res.set('Cache-Control', 'public, max-age=300').type('application/xml')
        .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
    } catch (err) {
      next(err);
    }
  });

  router.get('/', (req, res, next) => {
    // The trailing slash keeps all storefront-relative assets and links under its mount.
    if (!req.originalUrl.split('?')[0].endsWith('/') && publicUrl.pathname !== '/') {
      return res.redirect(308, publicUrl.href + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
    }
    return next();
  });

  router.get(/^\/(?:[^/]+\.html)?$/, async (req, res, next) => {
    const query = new URL(req.url, 'http://localhost').searchParams;
    const route = resolve(req.path.slice(1) || 'index.html', query);
    try {
      let status = route.missing ? 404 : 200;
      let data;
      try {
        data = await getPageMetadata(route);
        if (!data) {
          status = 404;
          data = fallback({ ...route, missing: true, noIndex: true });
        }
      } catch (err) {
        logger.error('Orbi storefront metadata unavailable:', err);
        // Keep the storefront available during a database outage and let crawlers retry.
        res.set('Retry-After', '60');
        status = 503;
        data = fallback({ ...route, noIndex: true });
      }
      const html = await readFile(path.join(directory, status === 404 ? 'error.html' : route.file), 'utf8');
      const head = seo.buildHead(data);
      const tags = head.tags.replace(/<(meta|link|script) /g, '<$1 data-orbi-seo ');
      const rendered = status !== 503 ? '<meta name="orbi-seo-rendered" content="true">' : '';
      const boot = `<script>var API_URL=${JSON.stringify(apiOrigin + '/api/')};var APP_URL=${JSON.stringify(apiOrigin + '/')};</script>`;
      const preview = status === 200 && route.kind !== 'general'
        ? `<noscript><section><h2>${escape(data.productData?.name || data.title)}</h2><p>${escape(data.description)}</p>
          ${data.ogImage ? `<img src="${escape(data.ogImage)}" alt="${escape(data.ogImageAlt || data.title)}" style="max-width: min(100%, 320px)">` : ''}
          <p><a href="sitemap.html">Browse the Orbi Seeds site map</a></p></section></noscript>` : '';
      res.set('Cache-Control', 'no-store');
      // These legacy storefront templates use inline scripts and styles, unlike the API and React client.
      res.set('Content-Security-Policy', [
        "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
        "style-src 'self' 'unsafe-inline' https:", "font-src 'self' https: data:", "img-src 'self' https: http: data:",
        "connect-src 'self' " + apiOrigin,
      ].join('; '));
      if (data.noIndex) res.set('X-Robots-Tag', 'noindex, nofollow');
      res.status(status).type('html').send(html
        .replace(/<!-- orbi-seo-start -->[\s\S]*?<!-- orbi-seo-end -->/, () => `<title>${escape(head.title)}</title>\n${tags}\n${rendered}\n${boot}`)
        .replace('<!-- orbi-seo-preview -->', () => preview));
    } catch (err) {
      next(err);
    }
  });

  // Serve only the storefront's public assets from the same mount.
  for (const folder of ['css', 'images', 'js', 'downloads']) {
    router.use('/' + folder, express.static(path.join(directory, folder)));
  }
  router.use((req, res) => res.sendStatus(404));
  app.use(mount, router);
}

module.exports = { mountOrbiStorefront };
