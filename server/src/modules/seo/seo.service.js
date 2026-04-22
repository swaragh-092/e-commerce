'use strict';

const { Product, Category } = require('../index');

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
    return `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /auth/\n\nSitemap: ${clientUrl}/api/seo/sitemap.xml`;
  }
}

module.exports = new SeoService();
