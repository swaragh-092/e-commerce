import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const seoService = require('../../src/modules/seo/seo.service');
const { isCrawler, crawlerPrerender, CRAWLER_USER_AGENTS } = require('../../src/middleware/crawlerPrerender.middleware');

describe('SEO Pre-rendering & Crawler Support', () => {
  describe('Crawler detection', () => {
    it('detects WhatsApp crawler user-agent', () => {
      expect(isCrawler('WhatsApp/2.21.12.21 A')).toBe(true);
    });

    it('detects Facebook crawler user-agent', () => {
      expect(isCrawler('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true);
      expect(isCrawler('Facebot')).toBe(true);
    });

    it('detects Twitter / X bot user-agent', () => {
      expect(isCrawler('Twitterbot/1.0')).toBe(true);
    });

    it('detects LinkedIn bot user-agent', () => {
      expect(isCrawler('LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)')).toBe(true);
    });

    it('detects Telegram, Discord, and Slack bots', () => {
      expect(isCrawler('TelegramBot (like TwitterBot)')).toBe(true);
      expect(isCrawler('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)')).toBe(true);
      expect(isCrawler('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)')).toBe(true);
    });

    it('detects Googlebot and Bingbot', () => {
      expect(isCrawler('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
      expect(isCrawler('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(true);
    });

    it('does not classify standard browser user-agents as crawlers', () => {
      expect(isCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBe(false);
      expect(isCrawler('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe(false);
      expect(isCrawler('')).toBe(false);
      expect(isCrawler(null)).toBe(false);
    });
  });

  describe('HTML Metadata Injection (injectMetadataIntoHtml)', () => {
    const sampleTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Default store description" />
    <title>Default Store Title</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

    it('injects product title, description, OG tags, Twitter card, and Schema.org', () => {
      const productMetadata = {
        title: 'Men Slim Fit Denim Jacket',
        titleSuffix: ' | Swaragh E-Shop',
        description: '100% premium cotton denim jacket with durable stitching.',
        keywords: 'denim, jacket, men fashion',
        ogImage: 'https://swaragh.org.in/uploads/jacket.jpg',
        canonicalUrl: 'https://swaragh.org.in/products/men-slim-fit-denim-jacket',
        noIndex: false,
        siteName: 'Swaragh E-Shop',
        type: 'product',
        productData: {
          price: '1999.00',
          currency: 'INR',
          availability: 'in stock',
        },
      };

      const resultHtml = seoService.injectMetadataIntoHtml(productMetadata, sampleTemplate);

      // Verify title replaced
      expect(resultHtml).toContain('<title>Men Slim Fit Denim Jacket | Swaragh E-Shop</title>');

      // Verify old description removed and new description injected
      expect(resultHtml).not.toContain('content="Default store description"');
      expect(resultHtml).toContain('<meta name="description" content="100% premium cotton denim jacket with durable stitching." />');

      // Verify Open Graph tags
      expect(resultHtml).toContain('<meta property="og:title" content="Men Slim Fit Denim Jacket | Swaragh E-Shop" />');
      expect(resultHtml).toContain('<meta property="og:description" content="100% premium cotton denim jacket with durable stitching." />');
      expect(resultHtml).toContain('<meta property="og:type" content="product" />');
      expect(resultHtml).toContain('<meta property="og:url" content="https://swaragh.org.in/products/men-slim-fit-denim-jacket" />');
      expect(resultHtml).toContain('<meta property="og:image" content="https://swaragh.org.in/uploads/jacket.jpg" />');
      expect(resultHtml).toContain('<meta property="og:site_name" content="Swaragh E-Shop" />');

      // Verify Twitter Card
      expect(resultHtml).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(resultHtml).toContain('<meta name="twitter:title" content="Men Slim Fit Denim Jacket | Swaragh E-Shop" />');
      expect(resultHtml).toContain('<meta name="twitter:image" content="https://swaragh.org.in/uploads/jacket.jpg" />');

      // Verify Product Rich Metadata
      expect(resultHtml).toContain('<meta property="product:price:amount" content="1999.00" />');
      expect(resultHtml).toContain('<meta property="product:price:currency" content="INR" />');
      expect(resultHtml).toContain('<meta property="product:availability" content="in stock" />');

      // Verify JSON-LD Schema.org
      expect(resultHtml).toContain('<script type="application/ld+json">');
      expect(resultHtml).toContain('"@type":"Product"');
      expect(resultHtml).toContain('"price":"1999.00"');
      expect(resultHtml).toContain('"https://schema.org/InStock"');

      // Verify Noscript semantic body fallback for crawlers without JS
      expect(resultHtml).toContain('<noscript>');
      expect(resultHtml).toContain('<h1>Men Slim Fit Denim Jacket | Swaragh E-Shop</h1>');
      expect(resultHtml).toContain('Price: INR 1999.00 &middot; Status: in stock');
    });

    it('injects website metadata for home/category routes', () => {
      const siteMetadata = {
        title: 'Best Electronics Online',
        titleSuffix: ' | TechMart',
        description: 'Browse top rated laptops and gadgets.',
        ogImage: 'https://techmart.com/banner.png',
        canonicalUrl: 'https://techmart.com/',
        noIndex: false,
        siteName: 'TechMart',
        type: 'website',
      };

      const resultHtml = seoService.injectMetadataIntoHtml(siteMetadata, sampleTemplate);

      expect(resultHtml).toContain('<title>Best Electronics Online | TechMart</title>');
      expect(resultHtml).toContain('<meta property="og:type" content="website" />');
      expect(resultHtml).toContain('"@type":"WebSite"');
    });
  });

  describe('crawlerPrerender middleware', () => {
    it('passes standard browsers to next() without rendering', async () => {
      const req = {
        method: 'GET',
        originalUrl: '/products/casual-shirt',
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
        query: {},
      };
      const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() };
      const next = vi.fn();

      await crawlerPrerender(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('ignores API and static asset requests even from crawlers', async () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/products/123',
        headers: { 'user-agent': 'WhatsApp/2.21' },
        query: {},
      };
      const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() };
      const next = vi.fn();

      await crawlerPrerender(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('intercepts crawler requests on storefront routes and returns HTML', async () => {
      const req = {
        method: 'GET',
        originalUrl: '/products/casual-shirt',
        headers: { 'user-agent': 'facebookexternalhit/1.1' },
        query: {},
      };
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };
      const next = vi.fn();

      vi.spyOn(seoService, 'renderHtmlForPath').mockResolvedValueOnce('<html><head><title>Mocked</title></head><body></body></html>');

      await crawlerPrerender(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('<html><head><title>Mocked</title></head><body></body></html>');
      expect(next).not.toHaveBeenCalled();
    });
  });
});
