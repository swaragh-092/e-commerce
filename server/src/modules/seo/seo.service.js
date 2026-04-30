'use strict';

const { Product, Category, SeoOverride, Setting } = require('../index');

class SeoService {
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
      xml += `    <loc>${clientUrl}/product/${product.slug}</loc>\n`;
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
    // Extract slug from common patterns: /product/slug or /category/slug
    const productMatch = urlPath.match(/^\/product\/([^\/]+)/);
    const categoryMatch = urlPath.match(/^\/category\/([^\/]+)/);

    if (productMatch) {
      let slug = productMatch[1];
      try {
        slug = decodeURIComponent(slug);
      } catch (e) {
        // Fallback to raw slug if decoding fails
      }
      const product = await Product.findOne({ where: { slug } });
      if (product) {
        return this._formatMetadata(product, 'product', urlPath);
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
    
    const metadata = {
      title: entity.metaTitle || (type === 'product' || type === 'category' ? entity.name : defaults.title),
      description: entity.metaDescription || defaults.description,
      keywords: entity.metaKeywords || defaults.keywords,
      ogImage: entity.ogImage || defaults.ogImage,
      canonicalUrl: entity.canonicalUrl || (urlPath ? `${baseUrl}${urlPath}` : null),
      noIndex: entity.noIndex || false,
      siteName: defaults.siteName,
      titleSuffix: defaults.titleSuffix,
      type: type === 'product' ? 'product' : 'website'
    };

    if (type === 'product') {
      metadata.productData = {
        price: entity.price,
        availability: entity.quantity > 0 ? 'in stock' : 'out of stock',
        currency: defaults.currency || 'USD'
      };
    }

    return metadata;
  }

  async _getGlobalDefaults() {
    const seoSettings = await Setting.findAll({ where: { group: 'seo' } });
    const generalSettings = await Setting.findAll({ where: { group: 'general' } });
    
    const settingsMap = {};
    seoSettings.forEach(s => settingsMap[s.key] = s.value);
    generalSettings.forEach(s => settingsMap[s.key] = s.value);

    return {
      siteName: settingsMap['seo.siteName'] || settingsMap['general.siteName'] || 'E-Commerce Store',
      title: settingsMap['seo.defaultTitle'] || 'Best Products Online',
      titleSuffix: settingsMap['seo.titleSuffix'] || ' | My Store',
      description: settingsMap['seo.defaultDescription'] || 'Shop the best products online at our store.',
      keywords: settingsMap['seo.defaultKeywords'] || 'ecommerce, shop, online',
      ogImage: settingsMap['seo.defaultOgImage'] || '',
      twitterHandle: settingsMap['seo.twitterHandle'] || '',
      currency: settingsMap['general.currency'] || 'USD'
    };
  }
}

module.exports = new SeoService();
