'use strict';

const fs = require('fs');
const path = require('path');
const { Product, Category, SeoOverride, Setting, ProductImage } = require('../index');

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

class SeoService {
  constructor() {
    this._cachedTemplate = null;
  }

  async generateSitemap() {
    const products = await Product.findAll({
      where: { status: 'published', isEnabled: true },
      attributes: ['slug', 'updatedAt']
    });

    const categories = await Category.findAll({
      attributes: ['slug', 'updatedAt']
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages
    xml += `  <url>\n    <loc>${clientUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${clientUrl}/products</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

    // Categories
    for (const category of categories) {
      xml += `  <url>\n`;
      xml += `    <loc>${clientUrl}/category/${category.slug}</loc>\n`;
      xml += `    <lastmod>${category.updatedAt ? category.updatedAt.toISOString() : new Date().toISOString()}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    }

    // Products
    for (const product of products) {
      xml += `  <url>\n`;
      xml += `    <loc>${clientUrl}/products/${product.slug}</loc>\n`;
      xml += `    <lastmod>${product.updatedAt ? product.updatedAt.toISOString() : new Date().toISOString()}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;
    return xml;
  }

  async generateRobots() {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    let robots = `User-agent: *\n`;
    robots += `Allow: /\n`;
    robots += `Disallow: /admin\n`;
    robots += `Disallow: /api\n`;
    robots += `\nSitemap: ${clientUrl}/sitemap.xml\n`;
    return robots;
  }

  async getMetadataByPath(urlPath) {
    // 1. Check for explicit overrides
    const override = await SeoOverride.findOne({ where: { path: urlPath } });
    if (override) {
      return this._formatMetadata(override, 'general', urlPath);
    }

    // 2. Check for Entity Specific SEO (Products/Categories)
    // Extract slug from common patterns: /products/slug or the legacy /product/slug
    const productMatch = urlPath.match(/^\/products?\/([^\/\?#]+)/);
    const categoryMatch = urlPath.match(/^\/category\/([^\/\?#]+)/);

    if (productMatch) {
      let slug = productMatch[1];
      try {
        slug = decodeURIComponent(slug);
      } catch (e) {
        // Fallback to raw slug if decoding fails
      }
      const product = await Product.findOne({
        where: { slug },
        include: [
          {
            model: ProductImage,
            as: 'images',
            attributes: ['url', 'isPrimary', 'sortOrder'],
            required: false,
          },
        ],
      });
      if (product) {
        return this._formatMetadata(product, 'product', `/products/${slug}`);
      }
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
        return this._formatMetadata(category, 'category', urlPath);
      }
    }

    // 3. Fallback to Global Defaults
    return this._getGlobalDefaults();
  }

  async _formatMetadata(entity, type = 'general', urlPath = '') {
    const defaults = await this._getGlobalDefaults();
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    let description = entity.metaDescription;
    if (!description && type === 'product') {
      description = stripHtml(entity.shortDescription || entity.description || '');
      if (description.length > 160) {
        description = `${description.slice(0, 157)}...`;
      }
    } else if (!description && type === 'category') {
      description = stripHtml(entity.description || '');
      if (description.length > 160) {
        description = `${description.slice(0, 157)}...`;
      }
    }
    if (!description) {
      description = defaults.description;
    }

    let ogImage = entity.ogImage;
    if (!ogImage && type === 'product' && Array.isArray(entity.images) && entity.images.length > 0) {
      const primary = entity.images.find((img) => img.isPrimary) || entity.images[0];
      ogImage = primary?.url || null;
    } else if (!ogImage && type === 'category') {
      ogImage = entity.bannerImage || entity.image || null;
    }
    if (!ogImage) {
      ogImage = defaults.ogImage;
    }

    // Ensure absolute image URL for external social crawlers (WhatsApp/FB/Twitter)
    if (ogImage && typeof ogImage === 'string' && !ogImage.startsWith('http://') && !ogImage.startsWith('https://')) {
      const cleanPath = ogImage.startsWith('/') ? ogImage : `/${ogImage}`;
      ogImage = `${baseUrl}${cleanPath}`;
    }

    let canonicalUrl = entity.canonicalUrl;
    if (!canonicalUrl && urlPath) {
      canonicalUrl = `${baseUrl}${urlPath}`;
    }

    const metadata = {
      title: entity.metaTitle || (type === 'product' || type === 'category' ? entity.name : defaults.title),
      description,
      keywords: entity.metaKeywords || defaults.keywords,
      ogImage: ogImage || '',
      canonicalUrl: canonicalUrl || baseUrl,
      noIndex: entity.noIndex || false,
      siteName: defaults.siteName,
      titleSuffix: defaults.titleSuffix,
      type: type === 'product' ? 'product' : 'website',
    };

    if (type === 'product') {
      metadata.productData = {
        price: entity.price,
        availability: entity.quantity > 0 ? 'in stock' : 'out of stock',
        currency: defaults.currency || 'INR',
      };
    }

    return metadata;
  }

  async _getGlobalDefaults() {
    const seoSettings = await Setting.findAll({ where: { group: 'seo' } });
    const generalSettings = await Setting.findAll({ where: { group: 'general' } });

    const settingsMap = {};
    seoSettings.forEach((s) => (settingsMap[s.key] = s.value));
    generalSettings.forEach((s) => (settingsMap[s.key] = s.value));

    return {
      siteName: settingsMap['seo.siteName'] || settingsMap['general.siteName'] || 'E-Commerce Store',
      title: settingsMap['seo.defaultTitle'] || 'Best Products Online',
      titleSuffix: settingsMap['seo.titleSuffix'] || ' | My Store',
      description: settingsMap['seo.defaultDescription'] || 'Shop the best products online at our store.',
      keywords: settingsMap['seo.defaultKeywords'] || 'ecommerce, shop, online',
      ogImage: settingsMap['seo.defaultOgImage'] || '',
      twitterHandle: settingsMap['seo.twitterHandle'] || '',
      currency: settingsMap['general.currency'] || 'INR',
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
    const suffix = metadata.titleSuffix || '';
    const rawTitle = metadata.title || metadata.siteName || 'Store';
    const fullTitle = suffix && !rawTitle.toLowerCase().includes(suffix.trim().toLowerCase())
      ? `${rawTitle}${suffix}`
      : rawTitle;

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
      if (metadata.productData.price) {
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
    let schemaObj = null;
    if (metadata.type === 'product' && metadata.productData) {
      schemaObj = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: rawTitle,
        description: metadata.description,
        image: metadata.ogImage ? [metadata.ogImage] : [],
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
    } else {
      schemaObj = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: metadata.siteName,
        url: metadata.canonicalUrl,
        description: metadata.description,
      };
    }
    tags.push(`<script type="application/ld+json">${JSON.stringify(schemaObj)}</script>`);

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
