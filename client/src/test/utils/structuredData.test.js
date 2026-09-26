import { describe, expect, it } from 'vitest';
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
} from '../../utils/seo/buildStructuredData';

const baseProduct = {
  id: 'product-1',
  name: 'Trail Jacket',
  slug: 'trail-jacket',
  sku: 'TJ-001',
  type: 'simple',
  price: 129,
  effectivePrice: 99,
  quantity: 4,
  brand: { name: 'North Peak' },
  shortDescription: 'A weather-ready jacket.',
  images: [{ url: '/uploads/trail-jacket.jpg' }],
};

const variant = (id, sku, color, price = 99) => ({
  id,
  sku,
  price,
  stockQty: 3,
  isActive: true,
  images: [{ url: `/uploads/${sku}.jpg` }],
  options: [{
    attributeId: 'color',
    attribute: { id: 'color', name: 'Color' },
    valueId: color.toLowerCase(),
    value: { id: color.toLowerCase(), value: color },
  }],
});

describe('ecommerce structured data builders', () => {
  it('builds a merchant-ready simple Product schema with the real brand', () => {
    const schema = buildProductJsonLd({
      product: baseProduct,
      currency: 'USD',
      stockAvailable: true,
      displaySku: baseProduct.sku,
      pageUrl: 'https://shop.example/products/trail-jacket',
      canonicalBaseUrl: 'https://shop.example',
    });

    expect(schema).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Trail Jacket',
      brand: { '@type': 'Brand', name: 'North Peak' },
      offers: {
        url: 'https://shop.example/products/trail-jacket',
        priceCurrency: 'USD',
        price: '99.00',
        availability: 'https://schema.org/InStock',
      },
    });
    expect(schema.image).toEqual(['https://shop.example/uploads/trail-jacket.jpg']);
  });

  it('adds priceValidUntil only for active dated sales', () => {
    const schema = buildProductJsonLd({
      product: {
        ...baseProduct,
        salePrice: 89,
        effectivePrice: 89,
        isSaleActive: true,
        saleEndAt: '2030-01-15T23:59:59.000Z',
      },
      currency: 'USD',
      pageUrl: 'https://shop.example/products/trail-jacket',
      canonicalBaseUrl: 'https://shop.example',
    });

    expect(schema.offers.priceValidUntil).toBe('2030-01-15');

    const regularSchema = buildProductJsonLd({
      product: baseProduct,
      currency: 'USD',
      pageUrl: 'https://shop.example/products/trail-jacket',
      canonicalBaseUrl: 'https://shop.example',
    });
    expect(regularSchema.offers.priceValidUntil).toBeUndefined();
  });

  it('builds ProductGroup data with addressable variant offers', () => {
    const product = {
      ...baseProduct,
      type: 'variable',
      variants: [
        variant('variant-red', 'TJ-RED', 'Red', 99),
        variant('variant-blue', 'TJ-BLUE', 'Blue', 109),
      ],
    };
    const schema = buildProductJsonLd({
      product,
      selectedVariant: product.variants[0],
      currency: 'USD',
      pageUrl: 'https://shop.example/products/trail-jacket',
      canonicalBaseUrl: 'https://shop.example',
    });

    expect(schema['@type']).toBe('ProductGroup');
    expect(schema.productGroupID).toBe('TJ-001');
    expect(schema.variesBy).toEqual(['https://schema.org/color']);
    expect(schema.hasVariant).toHaveLength(2);
    expect(schema.hasVariant[0]).toMatchObject({
      sku: 'TJ-RED',
      inProductGroupWithID: 'TJ-001',
      offers: { url: 'https://shop.example/products/trail-jacket?variant=TJ-RED' },
    });
  });

  it('only emits reviews that have visible authored content', () => {
    const schema = buildProductJsonLd({
      product: baseProduct,
      currency: 'USD',
      pageUrl: 'https://shop.example/products/trail-jacket',
      canonicalBaseUrl: 'https://shop.example',
      visibleReviews: [
        { rating: 5, body: 'Excellent fit.', User: { firstName: 'Ava', lastName: 'Stone' } },
        { rating: 4, body: '', User: { firstName: 'Hidden', lastName: '' } },
        { rating: 3, title: 'Good', User: { firstName: 'Ben', lastName: 'Fox' } },
      ],
    });

    expect(schema.review).toHaveLength(2);
    expect(schema.aggregateRating).toMatchObject({ reviewCount: 2, ratingValue: 4 });
    expect(schema.review[0].author.name).toBe('Ava Stone');
  });

  it('resolves breadcrumb URLs against the canonical origin', () => {
    const schema = buildBreadcrumbJsonLd({
      items: [
        { name: 'Home', url: '/' },
        { name: 'Products', url: '/products' },
        { name: 'Trail Jacket' },
      ],
      canonicalBaseUrl: 'https://shop.example',
      pageUrl: 'https://shop.example/products/trail-jacket',
    });

    expect(schema.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://shop.example/' },
      { '@type': 'ListItem', position: 2, name: 'Products', item: 'https://shop.example/products' },
      { '@type': 'ListItem', position: 3, name: 'Trail Jacket' },
    ]);
  });
});
