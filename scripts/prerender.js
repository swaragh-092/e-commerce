'use strict';

/**
 * Build-time Pre-rendering Script
 * 
 * Generates static pre-rendered HTML files for products, categories, and main storefront routes.
 * Run after `npm run build` in client:
 *   node scripts/prerender.js
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const { sequelize, Product, Category } = require('../server/src/modules');
const seoService = require('../server/src/modules/seo/seo.service');

const DIST_DIR = path.resolve(__dirname, '../client/dist');

async function prerender() {
  console.log('--- Starting E-Commerce SEO Pre-rendering ---');

  if (!fs.existsSync(DIST_DIR)) {
    console.warn(`[WARN] Client dist folder not found at ${DIST_DIR}. Make sure to run 'npm run build' in client first.`);
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  try {
    await sequelize.authenticate();
    console.log('[OK] Database connected.');

    const routes = [
      '/',
      '/products',
    ];

    // 1. Fetch published products
    const products = await Product.findAll({
      where: { status: 'published', isEnabled: true },
      attributes: ['slug'],
    });
    for (const p of products) {
      routes.push(`/products/${p.slug}`);
    }
    console.log(`[INFO] Found ${products.length} published products.`);

    // 2. Fetch categories
    const categories = await Category.findAll({
      attributes: ['slug'],
    });
    for (const c of categories) {
      routes.push(`/category/${c.slug}`);
    }
    console.log(`[INFO] Found ${categories.length} categories.`);

    console.log(`[INFO] Generating ${routes.length} pre-rendered pages...`);

    let generatedCount = 0;
    for (const route of routes) {
      try {
        const html = await seoService.renderHtmlForPath(route);

        // Target path: e.g. client/dist/products/slug/index.html (or client/dist/index.html for /)
        let filePath;
        if (route === '/') {
          filePath = path.join(DIST_DIR, 'index.html');
        } else {
          const routeDir = path.join(DIST_DIR, route.replace(/^\//, ''));
          fs.mkdirSync(routeDir, { recursive: true });
          filePath = path.join(routeDir, 'index.html');
        }

        fs.writeFileSync(filePath, html, 'utf8');
        generatedCount++;
      } catch (err) {
        console.error(`[ERROR] Failed to pre-render route "${route}":`, err.message);
      }
    }

    console.log(`[SUCCESS] Pre-rendering complete! Generated ${generatedCount} static pages.`);
  } catch (error) {
    console.error('[ERROR] Pre-rendering script failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  prerender();
}

module.exports = { prerender };
