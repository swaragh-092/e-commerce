import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const db = require('../../src/modules');
const productService = require('../../src/modules/product/product.service');
const settingsService = require('../../src/modules/settings/settings.service');
const variantService = require('../../src/modules/attribute/attribute.service');
const inventory = require('../../src/modules/inventory/inventory.service');
const cartService = require('../../src/modules/cart/cart.service');
const comboService = require('../../src/modules/product/productCombo.service');
const { createProductSchema } = require('../../src/modules/product/product.validation');
const { validateProductTypeChange } = require('../../src/modules/product/productType');
const audit = require('../../src/modules/audit/audit.service');
const { events } = require('../../src/utils/events');
const tx = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
afterEach(() => vi.restoreAllMocks());

describe('product type inventory lifecycle', () => {
  let product;
  beforeEach(() => {
    vi.clearAllMocks();
    product = { id: 'product', type: 'simple', slug: 'test', name: 'Test', price: 100, quantity: 10, reservedQty: 0, status: 'draft', update: vi.fn(), setCategories: vi.fn() };
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => typeof callback === 'function' ? callback(tx) : tx);
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);
    vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.Product, 'findByPk').mockImplementation(async () => product);
    vi.spyOn(db.Product, 'update').mockResolvedValue([1]);
    vi.spyOn(db.ProductVariant, 'findAll').mockResolvedValue([]);
    vi.spyOn(db.ProductVariant, 'count').mockResolvedValue(0);
    vi.spyOn(db.ProductVariant, 'sum').mockResolvedValue(0);
    vi.spyOn(db.ProductVariant, 'create').mockResolvedValue({ id: 'variant' });
    vi.spyOn(db.ProductComboItem, 'count').mockResolvedValue(0);
    vi.spyOn(inventory, 'adjust').mockResolvedValue({ changed: true });
    vi.spyOn(productService, 'getProductBySlug').mockImplementation(async () => product);
    vi.spyOn(audit, 'log').mockResolvedValue(null);
    vi.spyOn(events, 'emit').mockReturnValue(false);
  });
  it('accepts saving a Variable product before creating any variants', () => {
    expect(createProductSchema.validate({ name: 'Shirt', price: 100, type: 'variable', requiresShipping: false }).error).toBeUndefined();
    expect(createProductSchema.validate({ name: 'Shirt', price: 100, type: 'variable', quantity: 10 }).error).toBeDefined();
    expect(createProductSchema.validate({ name: 'Shirt', price: 100, type: 'simple', quantity: 10 }).error).toBeUndefined();
  });
  it.each(['create', 'update'])('rolls back the %s transaction when feature settings cannot be read', async (operation) => {
    vi.spyOn(settingsService, 'getFeatures').mockRejectedValue(new Error('settings unavailable'));
    const save = operation === 'create'
      ? productService.createProduct({ name: 'Test', type: 'simple' })
      : productService.updateProduct('product', { name: 'Changed' });
    await expect(save).rejects.toThrow('settings unavailable');
    expect(tx.rollback).toHaveBeenCalledOnce();
  });
  it('requires explicit confirmation to clear standalone stock', async () => {
    await expect(productService.updateProduct('product', { type: 'variable' })).rejects.toThrow('Confirm clearing');
    expect(product.update).not.toHaveBeenCalled();
    expect(inventory.adjust).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalled();
  });
  it('records a confirmed conversion then synchronizes empty Variable stock to zero', async () => {
    await productService.updateProduct('product', { type: 'variable', confirmInventoryReset: true });
    expect(inventory.adjust).toHaveBeenCalledWith(expect.objectContaining({ productId: 'product', newQuantity: 0, transaction: tx }));
    expect(product.update).toHaveBeenCalledWith({ type: 'variable' }, { transaction: tx });
    expect(db.Product.update).toHaveBeenCalledWith({ quantity: 0, reservedQty: 0 }, { where: { id: 'product' }, transaction: tx });
    expect(tx.commit).toHaveBeenCalled();
  });
  it('preserves legacy variants while correcting Simple to Variable', async () => {
    db.ProductVariant.count.mockResolvedValue(2);
    db.ProductVariant.sum.mockImplementation(async (field) => field === 'stockQty' ? 17 : 0);
    await productService.updateProduct('product', { type: 'variable' });
    expect(inventory.adjust).not.toHaveBeenCalled();
    expect(db.Product.update).toHaveBeenCalledWith({ quantity: 17, reservedQty: 0 }, expect.anything());
  });
  it.each(['simple', 'combo'])('blocks converting existing variants to %s', async (type) => {
    product.type = 'variable'; db.ProductVariant.count.mockResolvedValue(1);
    await expect(productService.updateProduct('product', { type })).rejects.toThrow('remove all variants');
    expect(product.update).not.toHaveBeenCalled();
  });
  it('blocks bundle conversion until its component items are cleared', async () => {
    product.type = 'combo'; db.ProductComboItem.count.mockResolvedValue(1);
    await expect(productService.updateProduct('product', { type: 'simple', quantity: 0 })).rejects.toThrow('Clear the bundle');
    expect(product.update).not.toHaveBeenCalled();
  });
  it('blocks changing a reserved simple product even with reset confirmation', async () => {
    product.reservedQty = 2;
    await expect(productService.updateProduct('product', { type: 'variable', confirmInventoryReset: true })).rejects.toThrow('reserving');
    expect(inventory.adjust).not.toHaveBeenCalled();
  });
  it.each(['variable', 'combo'])('rejects direct quantity updates on %s', async (type) => {
    product.type = type;
    await expect(productService.updateProduct('product', { quantity: 15 })).rejects.toThrow('Edit their stock');
    expect(inventory.adjust).not.toHaveBeenCalled();
  });
  it('keeps ordinary Simple stock adjustments in the inventory ledger flow', async () => {
    await productService.updateProduct('product', { quantity: 12 });
    expect(inventory.adjust).toHaveBeenCalledWith(expect.objectContaining({ productId: 'product', newQuantity: 12, transaction: tx }));
  });
  it('prevents wholesale replacement of existing variants through product updates', async () => {
    product.type = 'variable'; db.ProductVariant.count.mockResolvedValue(2);
    await expect(productService.updateProduct('product', { variants: [] })).rejects.toThrow('variant editor');
    expect(product.update).not.toHaveBeenCalled();
    expect(db.ProductVariant.create).not.toHaveBeenCalled();
  });
  it.each(['simple', 'combo'])('rejects preview and direct creation of variants for %s', async (type) => {
    product.type = type;
    await expect(variantService.previewVariantGeneration('product')).rejects.toThrow('Save the product as Variable');
    await expect(variantService.addProductVariant('product', { options: [] })).rejects.toThrow('Save the product as Variable');
    expect(db.ProductVariant.create).not.toHaveBeenCalled();
  });
  it('requires correct type when replacing variants through the product API', () => {
    expect(() => validateProductTypeChange(product, { variants: [{ stockQty: 1 }] })).toThrow('Keep Variable Product');
  });
  it('requires a specific variant when adding a Variable product to a bundle', async () => {
    product.type = 'combo';
    vi.spyOn(db.Product, 'findAll').mockResolvedValue([{ id: 'component', type: 'variable' }]);
    vi.spyOn(db.ProductComboItem, 'destroy').mockResolvedValue(0);
    await expect(comboService.syncComboItems('product', [{ itemProductId: 'component', quantity: 1 }])).rejects.toThrow('specific variant');
    expect(db.ProductComboItem.destroy).not.toHaveBeenCalled();
  });
});

describe('inventory and cart type safeguards', () => {
  beforeEach(() => {
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(tx));
    vi.spyOn(db.Cart, 'findOne').mockResolvedValue({ id: 'cart' });
    vi.spyOn(db.Cart, 'findByPk').mockResolvedValue({ id: 'cart' });
    vi.spyOn(db.ProductVariant, 'count').mockResolvedValue(0);
    vi.spyOn(db.Product, 'findByPk').mockResolvedValue({ id: 'product', type: 'variable', quantity: 50, reservedQty: 0, isEnabled: true, deletedAt: null });
    vi.spyOn(db.CartItem, 'create').mockResolvedValue({});
  });
  it('rejects adding an empty Variable product even if its old parent stock is positive', async () => {
    await expect(cartService.addItem('user', null, { productId: 'product', quantity: 1 })).rejects.toThrow('select a variant');
    expect(db.CartItem.create).not.toHaveBeenCalled();
  });
  it.each(['variable', 'combo'])('rejects manual parent inventory adjustment for %s', async (type) => {
    const update = vi.fn();
    db.Product.findByPk.mockResolvedValue({ id: 'product', type, quantity: 10, reservedQty: 0, update });
    await expect(inventory.adjust({ productId: 'product', newQuantity: 12, transaction: tx })).rejects.toThrow('variant or bundle component');
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects manual parent stock on legacy Simple products that have variants', async () => {
    db.Product.findByPk.mockResolvedValue({ type: 'simple', quantity: 10, reservedQty: 0 });
    db.ProductVariant.count.mockResolvedValue(1);
    await expect(inventory.adjust({ productId: 'product', newQuantity: 12, transaction: tx })).rejects.toThrow('Change its type');
  });
});
