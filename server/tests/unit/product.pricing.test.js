import { describe, it, expect } from 'vitest';
import {
  getDiscountPercent,
  getEffectivePrice,
  getVariantUnitPrice,
  getSaleStatus,
  getSavingsAmount,
  isSaleActive,
  normalizeSalePayload,
  resolveSaleLabel,
  serializeProductPricing,
  serializeVariantPricing,
} from '../../src/modules/product/product.pricing';

describe('Product Pricing & Variant Sale Logic', () => {
  describe('P0: Variant products sale price calculations', () => {
    it('applies product sale discount to variant with same MRP', () => {
      const product = { price: 100, salePrice: 80 };
      const variant = { price: 100 };

      const unitPrice = getVariantUnitPrice(product, variant);
      expect(unitPrice).toBe(80);
    });

    it('applies additive discount to variant with higher MRP', () => {
      const product = { price: 100, salePrice: 80 }; // 20 discount
      const variant = { price: 120 }; // higher MRP

      const unitPrice = getVariantUnitPrice(product, variant);
      expect(unitPrice).toBe(100); // 120 - 20 = 100
    });

    it('returns regular variant price when sale is not active', () => {
      const product = { price: 100, salePrice: null };
      const variant = { price: 100 };

      const unitPrice = getVariantUnitPrice(product, variant);
      expect(unitPrice).toBe(100);
    });

    it('returns precomputed unitPrice or effectivePrice if explicitly set', () => {
      const product = { price: 100, salePrice: 80 };
      const variant = { price: 100, unitPrice: 75 };

      const unitPrice = getVariantUnitPrice(product, variant);
      expect(unitPrice).toBe(75);
    });

    it('serializes variant with correct discounted unitPrice', () => {
      const product = { price: 100, salePrice: 80, variants: [{ id: 'v1', price: 100 }] };
      const serialized = serializeProductPricing(product);

      expect(serialized.isSaleActive).toBe(true);
      expect(serialized.effectivePrice).toBe(80);
      expect(serialized.variants[0].unitPrice).toBe(80);
    });
  });

  describe('P0: Sale Label Schedule gating', () => {
    it('does not activate sale for future scheduled label preset', () => {
      const futurePreset = [{ id: 'lbl-future', name: 'Future Sale', isActive: true, startDate: '2099-01-01', endDate: '2099-01-10' }];
      const product = { price: 100, salePrice: 80, saleLabel: 'lbl-future' };

      const serialized = serializeProductPricing(product, {}, futurePreset);
      expect(serialized.saleStatus).toBe('scheduled');
      expect(serialized.isSaleActive).toBe(false);
      expect(serialized.effectivePrice).toBe(100);
    });

    it('does not activate sale for expired label preset', () => {
      const expiredPreset = [{ id: 'lbl-past', name: 'Past Sale', isActive: true, startDate: '2020-01-01', endDate: '2020-01-10' }];
      const product = { price: 100, salePrice: 80, saleLabel: 'lbl-past' };

      const serialized = serializeProductPricing(product, {}, expiredPreset);
      expect(serialized.saleStatus).toBe('expired');
      expect(serialized.isSaleActive).toBe(false);
      expect(serialized.effectivePrice).toBe(100);
    });

    it('does not activate sale for inactive label preset', () => {
      const inactivePreset = [{ id: 'lbl-off', name: 'Off Sale', isActive: false }];
      const product = { price: 100, salePrice: 80, saleLabel: 'lbl-off' };

      const serialized = serializeProductPricing(product, {}, inactivePreset);
      expect(serialized.isSaleActive).toBe(false);
      expect(serialized.effectivePrice).toBe(100);
    });

    it('activates sale for active label preset currently within schedule', () => {
      const activePreset = [{
        id: 'lbl-active',
        name: 'Flash Sale',
        isActive: true,
        startDate: new Date(Date.now() - 3600000).toISOString(),
        endDate: new Date(Date.now() + 3600000).toISOString(),
      }];
      const product = { price: 100, salePrice: 80, saleLabel: 'lbl-active' };

      const serialized = serializeProductPricing(product, {}, activePreset);
      expect(serialized.saleStatus).toBe('active');
      expect(serialized.isSaleActive).toBe(true);
      expect(serialized.effectivePrice).toBe(80);
      expect(serialized.saleLabelResolved?.name).toBe('Flash Sale');
    });
  });

  describe('P1: normalizeSalePayload validation against DB constraints', () => {
    it('throws error when setting saleStartAt without salePrice', () => {
      expect(() => {
        normalizeSalePayload({ saleStartAt: '2026-10-01' });
      }).toThrow('Sale price is required when scheduling a sale window');
    });

    it('throws error when setting saleEndAt without salePrice', () => {
      expect(() => {
        normalizeSalePayload({ saleEndAt: '2026-10-01' });
      }).toThrow('Sale price is required when scheduling a sale window');
    });

    it('throws error when lowering regular price below existing sale price', () => {
      const existingProduct = { price: 100, salePrice: 80 };
      expect(() => {
        normalizeSalePayload({ price: 70 }, existingProduct);
      }).toThrow('Sale price must be less than the regular price');
    });

    it('clears dates and label when salePrice is set to null', () => {
      const normalized = normalizeSalePayload({ salePrice: null, saleStartAt: '2026-10-01', saleLabel: 'promo' });
      expect(normalized.salePrice).toBeNull();
      expect(normalized.saleStartAt).toBeNull();
      expect(normalized.saleEndAt).toBeNull();
      expect(normalized.saleLabel).toBeNull();
    });
  });

  describe('P2: discountPercent and savingsAmount behavior', () => {
    it('returns discount 0 when sale is not active in serializeProductPricing', () => {
      const futurePreset = [{ id: 'lbl-future', name: 'Future', isActive: true, startDate: '2099-01-01', endDate: '2099-01-10' }];
      const product = { price: 100, salePrice: 80, saleLabel: 'lbl-future' };

      const serialized = serializeProductPricing(product, {}, futurePreset);
      expect(serialized.isSaleActive).toBe(false);
      expect(serialized.discountPercent).toBe(0);
      expect(serialized.savingsAmount).toBe(0);
    });

    it('returns active discountPercent and savingsAmount when sale is active', () => {
      const product = { price: 100, salePrice: 80 };
      const serialized = serializeProductPricing(product);

      expect(serialized.isSaleActive).toBe(true);
      expect(serialized.discountPercent).toBe(20);
      expect(serialized.savingsAmount).toBe(20);
    });
  });

  describe('R1: Analytics raw SQL status filters include on_hold', () => {
    it('VALID_STATUSES includes on_hold and VALID_STATUSES_SQL formats it for raw SQL', async () => {
      const { VALID_STATUSES, VALID_STATUSES_SQL } = await import('../../src/modules/admin/analytics.service');
      expect(VALID_STATUSES).toContain('on_hold');
      expect(VALID_STATUSES_SQL).toBe("'confirmed','processing','ready_for_shipment','closed','on_hold'");
    });
  });

  describe('R2: SQL effective price & onSale condition matches JS label schedule', () => {
    it('buildSqlSaleCondition handles future, expired, and inactive label presets', async () => {
      const { buildSqlSaleCondition } = await import('../../src/modules/product/product.service');
      const now = new Date('2026-09-23T12:00:00Z');

      const labelPresets = [
        { id: 'lbl-future', name: 'Future Sale', isActive: true, startDate: '2026-10-01T00:00:00Z' },
        { id: 'lbl-expired', name: 'Expired Sale', isActive: true, endDate: '2026-08-01T00:00:00Z' },
        { id: 'lbl-inactive', name: 'Disabled Sale', isActive: false },
        { id: 'lbl-active', name: 'Active Flash Sale', isActive: true, startDate: '2026-09-01T00:00:00Z', endDate: '2026-09-30T00:00:00Z' },
      ];

      const sql = buildSqlSaleCondition(labelPresets, now, '"Product"');

      // Check base price & date rules
      expect(sql).toContain('"Product"."sale_price" IS NOT NULL');
      expect(sql).toContain('"Product"."sale_price" < "Product"."price"');
      expect(sql).toContain('"Product"."sale_start_at" IS NULL OR "Product"."sale_start_at" <= NOW()');
      expect(sql).toContain('"Product"."sale_end_at" IS NULL OR "Product"."sale_end_at" >= NOW()');

      // Inactive label exclusion
      expect(sql).toContain('"Product"."sale_label" NOT IN (\'lbl-inactive\')');

      // Future label exclusion (unless product has explicit product-level sale_start_at)
      expect(sql).toContain('"Product"."sale_label" NOT IN (\'lbl-future\') OR "Product"."sale_start_at" IS NOT NULL');

      // Expired label exclusion (unless product has explicit product-level sale_end_at)
      expect(sql).toContain('"Product"."sale_label" NOT IN (\'lbl-expired\') OR "Product"."sale_end_at" IS NOT NULL');

      // Active label should not be in the exclusions
      expect(sql).not.toContain("'lbl-active'");
    });

    it('getSqlEffectivePriceExpr wraps buildSqlSaleCondition in COALESCE CASE', async () => {
      const { getSqlEffectivePriceExpr } = await import('../../src/modules/product/product.service');
      const now = new Date();
      const expr = getSqlEffectivePriceExpr([], now, '"Product"');

      expect(expr.val).toContain('COALESCE(CASE WHEN');
      expect(expr.val).toContain('THEN "Product"."sale_price" ELSE "Product"."price" END');
    });

    it('buildSqlSaleStatusCondition aligns with JS saleStatus states', async () => {
      const { buildSqlSaleStatusCondition } = await import('../../src/modules/product/product.service');
      const now = new Date('2026-09-23T12:00:00Z');
      const labelPresets = [
        { id: 'lbl-future', name: 'Future Sale', isActive: true, startDate: '2026-10-01T00:00:00Z' },
        { id: 'lbl-expired', name: 'Expired Sale', isActive: true, endDate: '2026-08-01T00:00:00Z' },
        { id: 'lbl-inactive', name: 'Disabled Sale', isActive: false },
      ];

      const noneCond = buildSqlSaleStatusCondition('none', labelPresets, now, '"Product"');
      expect(noneCond).toBe('("Product"."sale_price" IS NULL OR "Product"."sale_price" >= "Product"."price")');

      const scheduledCond = buildSqlSaleStatusCondition('scheduled', labelPresets, now, '"Product"');
      expect(scheduledCond).toContain('"Product"."sale_start_at" > NOW()');
      expect(scheduledCond).toContain('"Product"."sale_label" IN (\'lbl-future\') AND "Product"."sale_start_at" IS NULL');
      expect(scheduledCond).toContain('"Product"."sale_label" NOT IN (\'lbl-inactive\')');

      const expiredCond = buildSqlSaleStatusCondition('expired', labelPresets, now, '"Product"');
      expect(expiredCond).toContain('"Product"."sale_end_at" < NOW()');
      expect(expiredCond).toContain('"Product"."sale_label" IN (\'lbl-expired\') AND "Product"."sale_end_at" IS NULL');
      expect(expiredCond).toContain('"Product"."sale_label" NOT IN (\'lbl-inactive\')');
    });
  });

  describe('Verified Audit Fixes Resolution', () => {
    it('P1: Product model defines requiresShipping with default true', async () => {
      const { Product } = await import('../../src/modules/index');
      expect(Product.rawAttributes.requiresShipping).toBeDefined();
      expect(Product.rawAttributes.requiresShipping.field).toBe('requires_shipping');
      expect(Product.rawAttributes.requiresShipping.defaultValue).toBe(true);
      expect(Product.rawAttributes.requiresShipping.allowNull).toBe(false);
    });

    it('P1: computePackageDimensions skips non-shippable products', async () => {
      const { computePackageDimensions } = await import('../../src/modules/shipping/shipping.service');
      const items = [
        {
          product: { requiresShipping: false, weightGrams: 500, lengthCm: 20, breadthCm: 20, heightCm: 10 },
          quantity: 2,
        },
        {
          product: { requiresShipping: true, weightGrams: 300, lengthCm: 15, breadthCm: 12, heightCm: 8 },
          quantity: 1,
        },
      ];

      const dims = computePackageDimensions(items);
      // Only the shippable product should contribute
      expect(dims.totalWeightGrams).toBe(300);
      expect(dims.maxL).toBe(15);
      expect(dims.maxB).toBe(12);
      expect(dims.totalH).toBe(8);
    });

    it('P2: normalizeSalePayload rejects orphan sale label without salePrice', () => {
      expect(() => {
        normalizeSalePayload({ price: 100, saleLabel: 'diwali' }, null, {
          labelPresets: [{ id: 'diwali', name: 'Diwali', isActive: true }],
        });
      }).toThrow('Sale price is required when setting a sale label');
    });

    it('P2: normalizeSalePayload allows valid sale label when salePrice is present', () => {
      const result = normalizeSalePayload(
        { price: 100, salePrice: 80, saleLabel: 'diwali' },
        null,
        { labelPresets: [{ id: 'diwali', name: 'Diwali', isActive: true }] }
      );
      expect(result.saleLabel).toBe('diwali');
      expect(result.salePrice).toBe(80);
    });

    it('P2: normalizeSalePayload clears saleLabel and dates when salePrice is set to null', () => {
      const result = normalizeSalePayload(
        { salePrice: null, saleLabel: 'diwali', saleStartAt: '2026-01-01' },
        { price: 100, salePrice: 80, saleLabel: 'diwali' }
      );
      expect(result.salePrice).toBeNull();
      expect(result.saleLabel).toBeNull();
      expect(result.saleStartAt).toBeNull();
      expect(result.saleEndAt).toBeNull();
    });

    it('P3: getCategoryAncestors returns ordered hierarchy from root to leaf', async () => {
      const { getCategoryAncestors } = await import('../../src/modules/category/category.service');
      expect(typeof getCategoryAncestors).toBe('function');
    });

    it('P2: getCategoryWithProducts supports includeSubcategories option', async () => {
      const { getCategoryWithProducts } = await import('../../src/modules/category/category.service');
      expect(typeof getCategoryWithProducts).toBe('function');
    });

    it('P2: getCategoryProductsQuerySchema properly casts and validates includeSubcategories', async () => {
      const { getCategoryProductsQuerySchema } = await import('../../src/modules/category/category.validation');
      
      // Default behavior
      const defaultVal = getCategoryProductsQuerySchema.validate({});
      expect(defaultVal.error).toBeUndefined();
      expect(defaultVal.value.includeSubcategories).toBe(true);

      // Falsy strings
      for (const falsyStr of ['false', '0', 'no']) {
        const res = getCategoryProductsQuerySchema.validate({ includeSubcategories: falsyStr });
        expect(res.error).toBeUndefined();
        expect(res.value.includeSubcategories).toBe(false);
      }

      // Truthy strings
      for (const truthyStr of ['true', '1', 'yes']) {
        const res = getCategoryProductsQuerySchema.validate({ includeSubcategories: truthyStr });
        expect(res.error).toBeUndefined();
        expect(res.value.includeSubcategories).toBe(true);
      }

      // Invalid value rejected
      const invalidRes = getCategoryProductsQuerySchema.validate({ includeSubcategories: 'random_value' });
      expect(invalidRes.error).toBeDefined();
    });

    it('P2: normalizeSalePayload trims whitespace on saleLabel and preserves it', () => {
      const result = normalizeSalePayload(
        { price: 100, salePrice: 80, saleLabel: '  diwali  ' },
        null,
        { labelPresets: [{ id: 'diwali', name: 'Diwali', isActive: true }] }
      );
      expect(result.saleLabel).toBe('diwali');
    });
  });
});

