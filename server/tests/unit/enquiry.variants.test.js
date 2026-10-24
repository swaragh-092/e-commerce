import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { Product, ProductVariant, Enquiry } = require('../../src/modules');
const service = require('../../src/modules/enquiry/enquiry.service');
const settings = require('../../src/modules/settings/settings.service');
const notifications = require('../../src/modules/notification/notification.service');
const logger = require('../../src/utils/logger');
const { createEnquirySchema } = require('../../src/modules/enquiry/enquiry.validation');
const productId = '11111111-1111-4111-8111-111111111111';
const variantId = '22222222-2222-4222-8222-222222222222';
const customer = { name: 'Test User', email: 'test@example.com', message: 'Product details please.' };

describe('enquiry product and variant validation', () => {
  beforeEach(() => {
    vi.spyOn(Product, 'findByPk').mockResolvedValue({ id: productId, name: 'Marigold', sku: 'FLOWER', type: 'variable', status: 'published', isEnabled: true });
    vi.spyOn(ProductVariant, 'findOne').mockResolvedValue({ id: variantId, productId, sku: 'FLOWER-50', isActive: true, options: [] });
    vi.spyOn(ProductVariant, 'count').mockResolvedValue(1);
    vi.spyOn(Enquiry, 'create').mockRejectedValue(new Error('Unexpected record creation'));
  });
  afterEach(() => vi.restoreAllMocks());

  it('normalizes all accepted cart identifiers and uses the catalog name and SKU', async () => {
    for (const line of [
      { productId, variantId, quantity: 2 },
      { product: productId, variantId, quantity: 2 },
      { product: { id: productId, name: 'Spoofed name' }, variant: { id: variantId, sku: 'Spoofed SKU' }, quantity: 2 },
    ]) {
      const [result] = await service.normalizeCartItems([line]);
      expect(result).toMatchObject({ product: { id: productId, name: 'Marigold', sku: 'FLOWER' }, variant: { id: variantId, sku: 'FLOWER-50' }, quantity: 2 });
      expect(ProductVariant.findOne).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: variantId, productId, isActive: true } }));
    }
  });
  it('rejects inactive, missing or cross-product variants before creating an enquiry', async () => {
    ProductVariant.findOne.mockResolvedValue(null);
    await expect(service.createEnquiry({ ...customer, productId, variantId })).rejects.toThrow(/variant|option/i);
    expect(Enquiry.create).not.toHaveBeenCalled();
  });
  it('requires an option for a variable product, including old product-only enquiry lists', async () => {
    await expect(service.normalizeCartItems([{ productId, quantity: 1 }])).rejects.toThrow(/choose|select/i);
  });
  it('rejects unpublished or disabled products and fractional quantities', async () => {
    Product.findByPk.mockResolvedValueOnce({ id: productId, status: 'draft', isEnabled: true });
    await expect(service.normalizeCartItems([{ productId, variantId, quantity: 1 }])).rejects.toThrow(/unavailable|not found/i);
    await expect(service.normalizeCartItems([{ productId, variantId, quantity: 1.5 }])).rejects.toThrow(/quantity/i);
  });
  it('keeps a simple product enquiry valid without a variant, including out of stock', async () => {
    Product.findByPk.mockResolvedValue({ id: productId, name: 'Simple', type: 'simple', status: 'published', isEnabled: true, quantity: 0 });
    ProductVariant.count.mockResolvedValue(0);
    expect(await service.normalizeCartItems([{ productId, quantity: 1 }])).toMatchObject([{ product: { id: productId }, variant: null, quantity: 1 }]);
  });
  it('rejects empty cart payloads, missing products and mixed single/cart identifiers', () => {
    for (const extra of [{ cartItems: [] }, { cartItems: [{ quantity: 1 }] }, { cartItems: [{ productId, quantity: 1 }], variantId }, { productId, cartItems: [{ productId, quantity: 1 }] }]) {
      expect(createEnquirySchema.validate({ ...customer, ...extra }).error).toBeDefined();
    }
    expect(createEnquirySchema.validate({ ...customer, cartItems: [{ productId, variantId, quantity: 1 }] }).error).toBeUndefined();
  });
  it('saves the selected option and includes it in notifications without sending real emails', async () => {
    ProductVariant.findOne.mockResolvedValue({ id: variantId, productId, sku: null, isActive: true,
      options: [{ attribute: { name: 'Package Size' }, value: { value: '50', unitLabel: 'g' } }] });
    Enquiry.create.mockImplementation(async payload => ({ ...payload, id: 'enquiry-1' }));
    vi.spyOn(settings, 'getAll').mockResolvedValue({ general: { storeName: 'Test Store' } });
    vi.spyOn(service, 'getAdminNotificationEmails').mockResolvedValue([]);
    vi.spyOn(notifications, 'send').mockResolvedValue(true);
    const direct = await service.createEnquiry({ ...customer, productId, variantId, quantity: 3 });
    expect(direct).toMatchObject({ productId, variantId, quantity: 3 });
    expect(notifications.send.mock.calls[0][2].productName).toBe('Marigold (Package Size: 50g)');
    const list = await service.createEnquiry({ ...customer, cartItems: [{ productId, variantId, quantity: 2 }] });
    expect(list.cartItems[0].variant.optionLabel).toBe('Package Size: 50g');
    expect(notifications.send.mock.calls[1][2].cartItems[0].product.name).toBe('Marigold (Package Size: 50g)');
  });
  it('returns a saved enquiry successfully if notification settings fail afterwards', async () => {
    Enquiry.create.mockImplementation(async payload => ({ ...payload, id: 'enquiry-1' }));
    vi.spyOn(settings, 'getAll').mockRejectedValue(new Error('Notification settings unavailable'));
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    await expect(service.createEnquiry({ ...customer, productId, variantId })).resolves.toMatchObject({ id: 'enquiry-1', variantId });
    expect(Enquiry.create).toHaveBeenCalledOnce();
  });
});
