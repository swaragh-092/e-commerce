import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const {
  buildFeatures,
} = require('../../src/config/modes');
const {
  serializeProductPricing,
} = require('../../src/modules/product/product.pricing');
const SettingsService = require('../../src/modules/settings/settings.service');
const AuditService = require('../../src/modules/audit/audit.service');
const { PERMISSIONS } = require('../../src/config/permissions');
const { clearFeatureCache } = require('../../src/middleware/featureGate.middleware');

describe('Platform Features Control Suite', () => {
  beforeEach(() => {
    clearFeatureCache();
    vi.restoreAllMocks();
    if (AuditService && AuditService.log) {
      vi.spyOn(AuditService, 'log').mockResolvedValue(true);
    }
  });

  afterEach(() => {
    clearFeatureCache();
    vi.restoreAllMocks();
  });

  describe('1. Authorization: Only Superadmins may modify feature flags or store mode', () => {
    const regularAdminUser = {
      id: 'admin-uuid',
      role: 'admin',
      roles: ['admin'],
    };

    const superAdminUser = {
      id: 'superadmin-uuid',
      role: 'super_admin',
      roles: ['super_admin'],
    };

    it('rejects non-superadmin attempting to update a feature flag via updateKey', async () => {
      await expect(
        SettingsService.updateKey('reviews', false, 'features', regularAdminUser.id, regularAdminUser)
      ).rejects.toMatchObject({
        code: 'SUPERADMIN_REQUIRED',
        statusCode: 403,
      });
    });

    it('rejects non-superadmin attempting to update general.mode via updateKey', async () => {
      await expect(
        SettingsService.updateKey('mode', 'catalog', 'general', regularAdminUser.id, regularAdminUser)
      ).rejects.toMatchObject({
        code: 'SUPERADMIN_REQUIRED',
        statusCode: 403,
      });
    });

    it('rejects non-superadmin attempting to update a feature flag via updateKey when group is omitted', async () => {
      await expect(
        SettingsService.updateKey('wishlist', false, undefined, regularAdminUser.id, regularAdminUser)
      ).rejects.toMatchObject({
        code: 'SUPERADMIN_REQUIRED',
        statusCode: 403,
      });
    });

    it('rejects non-superadmin attempting to update tier-1 visibility', async () => {
      await expect(
        SettingsService.bulkUpdate(
          [{ group: 'visibility', key: 'storefrontCart', value: false }],
          regularAdminUser.id,
          regularAdminUser
        )
      ).rejects.toMatchObject({
        code: 'SUPERADMIN_REQUIRED',
        statusCode: 403,
      });
    });

    it('rejects non-superadmin attempting to update feature flags via bulkUpdate', async () => {
      await expect(
        SettingsService.bulkUpdate(
          [{ group: 'features', key: 'wishlist', value: false }],
          regularAdminUser.id,
          regularAdminUser
        )
      ).rejects.toMatchObject({
        code: 'SUPERADMIN_REQUIRED',
        statusCode: 403,
      });
    });

    it('rejects non-superadmin attempting to update store mode via bulkUpdate', async () => {
      await expect(
        SettingsService.bulkUpdate(
          [{ group: 'general', key: 'mode', value: 'catalog' }],
          regularAdminUser.id,
          regularAdminUser
        )
      ).rejects.toMatchObject({
        code: 'SUPERADMIN_REQUIRED',
        statusCode: 403,
      });
    });

    it('allows superadmin to update optional feature flag and general.mode', async () => {
      vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null);
      vi.spyOn(db.Setting, 'create').mockImplementation(async (data) => ({
        ...data,
        toJSON: () => data,
      }));
      vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (cb) => cb({}));

      const featureResult = await SettingsService.updateKey(
        'wishlist',
        false,
        'features',
        superAdminUser.id,
        superAdminUser
      );
      expect(featureResult.key).toBe('wishlist');

      const modeResult = await SettingsService.updateKey(
        'mode',
        'catalog',
        'general',
        superAdminUser.id,
        superAdminUser
      );
      expect(modeResult.key).toBe('mode');
    });

    it('allows regular admin to update non-feature and non-mode settings (e.g. general.storeName)', async () => {
      vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null);
      vi.spyOn(db.Setting, 'create').mockImplementation(async (data) => ({
        ...data,
        toJSON: () => data,
      }));
      vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (cb) => cb({}));

      const settingResult = await SettingsService.updateKey(
        'storeName',
        'My Store',
        'general',
        regularAdminUser.id,
        regularAdminUser
      );
      expect(settingResult.key).toBe('storeName');
    });
  });

  describe('2. Price Visibility: Complete redaction of prices when pricing or showPrice is disabled', () => {
    const mockProduct = {
      id: 'prod-1',
      name: 'Test Product',
      price: 199.99,
      salePrice: 149.99,
      costPrice: 80.00,
      unitPrice: 149.99,
      regularPrice: 199.99,
      effectivePrice: 149.99,
      savingsAmount: 50.00,
      discountPercent: 25,
      variants: [
        {
          id: 'var-1',
          name: 'Size L',
          price: 199.99,
          salePrice: 149.99,
          costPrice: 80.00,
          unitPrice: 149.99,
          regularPrice: 199.99,
          effectivePrice: 149.99,
          savingsAmount: 50.00,
          discountPercent: 25,
        },
      ],
    };

    it('redacts all price fields from product and variants when pricing feature is false', () => {
      const serialized = serializeProductPricing(mockProduct, {
        adminView: false,
        features: { pricing: false, showPrice: true },
      });

      expect(serialized.price).toBeUndefined();
      expect(serialized.salePrice).toBeUndefined();
      expect(serialized.costPrice).toBeUndefined();
      expect(serialized.unitPrice).toBeUndefined();
      expect(serialized.regularPrice).toBeUndefined();
      expect(serialized.effectivePrice).toBeUndefined();
      expect(serialized.savingsAmount).toBeUndefined();

      expect(serialized.variants[0].price).toBeUndefined();
      expect(serialized.variants[0].salePrice).toBeUndefined();
      expect(serialized.variants[0].costPrice).toBeUndefined();
      expect(serialized.variants[0].unitPrice).toBeUndefined();
      expect(serialized.variants[0].regularPrice).toBeUndefined();
      expect(serialized.variants[0].effectivePrice).toBeUndefined();
      expect(serialized.variants[0].savingsAmount).toBeUndefined();
      expect(serialized.variants[0].discountPercent).toBe(0);
    });

    it('redacts all price fields when showPrice is false', () => {
      const serialized = serializeProductPricing(mockProduct, {
        adminView: false,
        features: { pricing: true, showPrice: false },
      });

      expect(serialized.price).toBeUndefined();
      expect(serialized.salePrice).toBeUndefined();
      expect(serialized.effectivePrice).toBeUndefined();
      expect(serialized.variants[0].price).toBeUndefined();
      expect(serialized.variants[0].effectivePrice).toBeUndefined();
    });

    it('preserves all price fields when adminView is true, even if pricing or showPrice is false', () => {
      const serialized = serializeProductPricing(mockProduct, {
        adminView: true,
        features: { pricing: false, showPrice: false },
      });

      expect(serialized.price).toBe(199.99);
      expect(serialized.effectivePrice).toBe(149.99);
      expect(serialized.variants[0].price).toBe(199.99);
      expect(serialized.variants[0].effectivePrice).toBe(149.99);
    });

    it('redacts price fields from products and variants in wishlist service when showPrice is false', async () => {
      const WishlistService = require('../../src/modules/wishlist/wishlist.service');
      vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({
        features: { wishlist: true, pricing: true, showPrice: false },
      });
      vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (cb) => cb({}));
      vi.spyOn(db.Wishlist, 'findOne').mockResolvedValue({ id: 'wl-1' });
      vi.spyOn(db.WishlistItem, 'findAll').mockResolvedValue([
        {
          id: 'item-1',
          wishlistId: 'wl-1',
          Product: {
            id: 'prod-1',
            status: 'published',
            isEnabled: true,
            name: 'Wishlist Item',
            price: 100,
            salePrice: 80,
          },
          variant: {
            id: 'var-1',
            price: 100,
            salePrice: 80,
            unitPrice: 80,
            stockQty: 10,
          },
          toJSON() {
            return {
              id: this.id,
              wishlistId: this.wishlistId,
              Product: { ...this.Product },
              variant: { ...this.variant },
            };
          },
        },
      ]);

      const result = await WishlistService.getWishlist('user-1', null);
      expect(result.items).toHaveLength(1);
      const item = result.items[0];

      expect(item.Product.price).toBeUndefined();
      expect(item.Product.salePrice).toBeUndefined();
      expect(item.Product.effectivePrice).toBeUndefined();

      expect(item.variant.price).toBeUndefined();
      expect(item.variant.salePrice).toBeUndefined();
      expect(item.variant.unitPrice).toBeUndefined();
      expect(item.variant.effectivePrice).toBeUndefined();
    });
  });

  describe('3. Existing Records: Preserving authorized staff management while gating customer actions', () => {
    it('allows admin with ORDERS_READ through featureGateUnlessPermission when orders feature is false in catalog mode', async () => {
      const { featureGateUnlessPermission } = require('../../src/middleware/featureGate.middleware');
      vi.spyOn(db.Setting, 'findAll').mockResolvedValue([]);
      vi.spyOn(db.Setting, 'findOne').mockResolvedValue({ value: 'catalog' });

      const adminReq = {
        user: { id: 'admin-1', role: 'admin', roles: ['admin'] },
      };
      const customerReq = {
        user: { id: 'cust-1', role: 'customer', roles: ['customer'] },
      };

      const nextAdmin = vi.fn();
      await featureGateUnlessPermission('orders', PERMISSIONS.ORDERS_READ)(adminReq, {}, nextAdmin);
      expect(nextAdmin).toHaveBeenCalledWith(); // no error passed

      const nextCustomer = vi.fn();
      await featureGateUnlessPermission('orders', PERMISSIONS.ORDERS_READ)(customerReq, {}, nextCustomer);
      expect(nextCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FEATURE_DISABLED', statusCode: 403 })
      );
    });

    it('allows admin with REVIEWS_READ through admin review router regardless of feature flag', () => {
      const reviewAdminRoutes = require('../../src/modules/review/review.admin.routes');
      // The router stack should not have a top-level featureGate('reviews')
      const stack = reviewAdminRoutes.stack || [];
      const hasTopLevelFeatureGate = stack.some(
        (layer) => layer.route === undefined && layer.handle?.name === 'featureGate'
      );
      expect(hasTopLevelFeatureGate).toBe(false);
    });

    it('allows admin with ENQUIRIES_READ through admin enquiry router regardless of feature flag', () => {
      const enquiryAdminRoutes = require('../../src/modules/enquiry/enquiry.admin.routes');
      const stack = enquiryAdminRoutes.stack || [];
      const hasTopLevelFeatureGate = stack.some(
        (layer) => layer.route === undefined && layer.handle?.name === 'featureGate'
      );
      expect(hasTopLevelFeatureGate).toBe(false);
    });

    it('allows admin with COUPONS_READ through admin coupon routes regardless of feature flag', () => {
      const couponRoutes = require('../../src/modules/coupon/coupon.routes');
      const stack = couponRoutes.stack || [];
      const hasTopLevelFeatureGate = stack.some(
        (layer) => layer.route === undefined && layer.handle?.name === 'featureGate'
      );
      expect(hasTopLevelFeatureGate).toBe(false);
    });

    it('allows admin with ORDERS_UPDATE_STATUS to confirm COD payments when payments feature is disabled or in catalog mode, while gating customer create-order', () => {
      const paymentRoutes = require('../../src/modules/payment/payment.routes');
      const stack = paymentRoutes.stack || [];
      // There should not be a top-level featureGate('payments') middleware
      const hasTopLevelFeatureGate = stack.some(
        (layer) => layer.route === undefined && layer.handle?.name === 'featureGate'
      );
      expect(hasTopLevelFeatureGate).toBe(false);

      // POST /cod/confirm/:orderId should exist in route stack
      const codRouteLayer = stack.find(
        (layer) => layer.route?.path === '/cod/confirm/:orderId' && layer.route?.methods?.post
      );
      expect(codRouteLayer).toBeDefined();

      // POST /create-order should exist in route stack
      const createOrderRouteLayer = stack.find(
        (layer) => layer.route?.path === '/create-order' && layer.route?.methods?.post
      );
      expect(createOrderRouteLayer).toBeDefined();
    });
  });

  describe('4. Dependencies & Cascades: buildFeatures enforces valid constraint combinations', () => {
    it('forces requirePurchaseForReview to false in catalog mode', () => {
      const features = buildFeatures({ requirePurchaseForReview: true }, 'catalog');
      expect(features.requirePurchaseForReview).toBe(false);
    });

    it('forces requirePurchaseForReview to false when reviews is false', () => {
      const featuresWithoutReviews = buildFeatures(
        { requirePurchaseForReview: true, reviews: false },
        'ecommerce'
      );
      expect(featuresWithoutReviews.requirePurchaseForReview).toBe(false);
    });

    it('forces guestCheckout to false when checkout is false (e.g. catalog mode)', () => {
      const features = buildFeatures({ guestCheckout: true }, 'catalog');
      expect(features.guestCheckout).toBe(false);
    });

    it('forces showAvailableCoupons to false when coupons is false or cart is false', () => {
      const featuresWithoutCoupons = buildFeatures(
        { showAvailableCoupons: true, coupons: false },
        'ecommerce'
      );
      expect(featuresWithoutCoupons.showAvailableCoupons).toBe(false);

      const catalogFeatures = buildFeatures({ showAvailableCoupons: true }, 'catalog');
      expect(catalogFeatures.showAvailableCoupons).toBe(false);
      expect(catalogFeatures.coupons).toBe(false);
    });

    it('forces showPrice to false when pricing is false (e.g. catalog mode)', () => {
      const features = buildFeatures({ showPrice: true }, 'catalog');
      expect(features.showPrice).toBe(false);
    });
  });
});
