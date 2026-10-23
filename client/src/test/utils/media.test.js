import { describe, it, expect } from 'vitest';
import {
  getMediaUrl,
  PLACEHOLDER_PRODUCT,
  PLACEHOLDER_CATEGORY,
  PLACEHOLDER_BRAND,
  PLACEHOLDER_DEFAULT,
  onImageError,
} from '../../utils/media';

describe('media utils and placeholder defaults', () => {
  it('defines correct placeholder defaults for products, categories, and brands', () => {
    expect(PLACEHOLDER_PRODUCT).toBe('/product-placeholder.svg');
    expect(PLACEHOLDER_CATEGORY).toBe('/category-placeholder.svg');
    expect(PLACEHOLDER_BRAND).toBe('/product-placeholder.svg');
    expect(PLACEHOLDER_DEFAULT).toBe('/product-placeholder.svg');
  });

  describe('getMediaUrl', () => {
    it('returns empty string for falsy path', () => {
      expect(getMediaUrl(null)).toBe('');
      expect(getMediaUrl(undefined)).toBe('');
      expect(getMediaUrl('')).toBe('');
    });

    it('returns absolute URLs as-is', () => {
      expect(getMediaUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
      expect(getMediaUrl('http://example.com/photo.jpg')).toBe('http://example.com/photo.jpg');
      expect(getMediaUrl('data:image/png;base64,123')).toBe('data:image/png;base64,123');
    });

    it('prepends / to uploads/ path', () => {
      expect(getMediaUrl('uploads/products/item.png')).toBe('/uploads/products/item.png');
    });

    it('returns root paths as-is', () => {
      expect(getMediaUrl('/product-placeholder.svg')).toBe('/product-placeholder.svg');
    });

    it('routes single filename or thumbnail directory into /uploads/', () => {
      expect(getMediaUrl('sample.png')).toBe('/uploads/sample.png');
      expect(getMediaUrl('thumbnails/sample.png')).toBe('/uploads/thumbnails/sample.png');
    });
  });

  describe('onImageError', () => {
    it('replaces image src with the given placeholder', () => {
      const handler = onImageError(PLACEHOLDER_PRODUCT);
      const img = {
        dataset: {},
        src: 'https://broken.example.com/image.jpg',
      };

      handler({ currentTarget: img });

      expect(img.src).toBe(PLACEHOLDER_PRODUCT);
      expect(img.dataset.fallbackApplied).toBe('1');
    });

    it('prevents infinite recursion if fallback image also encounters an error', () => {
      const handler = onImageError(PLACEHOLDER_CATEGORY);
      const img = {
        dataset: { fallbackApplied: '1' },
        src: PLACEHOLDER_CATEGORY,
      };

      handler({ currentTarget: img });

      // Should not re-set src or trigger loops
      expect(img.src).toBe(PLACEHOLDER_CATEGORY);
    });

    it('handles subsequent errors when the image element is reused with a new src', () => {
      const handler = onImageError(PLACEHOLDER_PRODUCT);
      const img = {
        dataset: {},
        src: 'https://broken1.example.com/item.jpg',
      };

      handler({ currentTarget: img });
      expect(img.src).toBe(PLACEHOLDER_PRODUCT);

      // Element reused with another broken image
      img.src = 'https://broken2.example.com/item.jpg';
      handler({ currentTarget: img });
      expect(img.src).toBe(PLACEHOLDER_PRODUCT);
    });
  });
});
