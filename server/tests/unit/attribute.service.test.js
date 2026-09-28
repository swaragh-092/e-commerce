import { describe, it, expect, vi, beforeEach } from 'vitest';
const { getAttributesQuerySchema } = require('../../src/modules/attribute/attribute.validation');
const db = require('../../src/modules/index');
const { getAllAttributes, updateProductVariant } = require('../../src/modules/attribute/attribute.service');

describe('Attribute Templates Search & Filters', () => {
  describe('Query Schema Validation (getAttributesQuerySchema)', () => {
    it('applies default pagination and sort order', () => {
      const { error, value } = getAttributesQuerySchema.validate({});
      expect(error).toBeUndefined();
      expect(value.page).toBe(1);
      expect(value.limit).toBe(20);
      expect(value.sortBy).toBe('sortOrder');
      expect(value.sortOrder).toBe('ASC');
    });

    it('validates allowed displayType and valueType filters', () => {
      const valid = getAttributesQuerySchema.validate({
        displayType: 'swatch',
        valueType: 'color',
        hasValues: 'yes',
        sortBy: 'name',
        sortOrder: 'DESC',
      });
      expect(valid.error).toBeUndefined();
      expect(valid.value.displayType).toBe('swatch');
      expect(valid.value.valueType).toBe('color');
      expect(valid.value.hasValues).toBe('yes');
      expect(valid.value.sortBy).toBe('name');
      expect(valid.value.sortOrder).toBe('DESC');
    });

    it('accepts all as filter option for displayType and valueType', () => {
      const res = getAttributesQuerySchema.validate({
        displayType: 'all',
        valueType: 'all',
        hasValues: 'all',
      });
      expect(res.error).toBeUndefined();
    });

    it('rejects invalid displayType or valueType', () => {
      const invalid = getAttributesQuerySchema.validate({
        displayType: 'unsupported_display_type',
      });
      expect(invalid.error).toBeDefined();
    });
  });

  describe('Service Query Construction (getAllAttributes)', () => {
    let capturedOptions = null;

    beforeEach(() => {
      capturedOptions = null;
      db.AttributeTemplate.findAndCountAll = vi.fn().mockImplementation(async (opts) => {
        capturedOptions = opts;
        return { count: 1, rows: [{ id: '1', name: 'Size' }] };
      });
    });

    it('constructs search condition across name, slug, and values', async () => {
      const res = await getAllAttributes({ search: 'size' });
      expect(res.count).toBe(1);
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.where).toBeDefined();
      const symbols = Object.getOwnPropertySymbols(capturedOptions.where);
      const andKey = symbols.find((s) => s.description === 'and');
      expect(andKey).toBeDefined();
      expect(capturedOptions.where[andKey].length).toBeGreaterThan(0);
    });

    it('constructs filters by displayType and valueType', async () => {
      await getAllAttributes({ displayType: 'swatch', valueType: 'color' });
      expect(capturedOptions.where.displayType).toBe('swatch');
      expect(capturedOptions.where.valueType).toBe('color');
    });

    it('constructs hasValues existence subquery', async () => {
      await getAllAttributes({ hasValues: 'yes' });
      const symbols = Object.getOwnPropertySymbols(capturedOptions.where);
      const andKey = symbols.find((s) => s.description === 'and');
      expect(andKey).toBeDefined();
      expect(capturedOptions.where[andKey].length).toBeGreaterThan(0);
    });

    it('constructs custom sorting by name DESC', async () => {
      await getAllAttributes({ sortBy: 'name', sortOrder: 'DESC' });
      expect(capturedOptions.order[0]).toEqual(['name', 'DESC']);
    });

    it('supports legacy positional arguments (page, limit)', async () => {
      await getAllAttributes(2, 15);
      expect(capturedOptions.limit).toBe(15);
      expect(capturedOptions.offset).toBe(15);
    });
  });

  describe('updateProductVariant', () => {
    it('updates stockQty and records an InventoryTransaction when stock changes', async () => {
      const mockVariant = {
        id: 'var-1',
        productId: 'prod-1',
        stockQty: 5,
        reservedQty: 0,
        update: vi.fn().mockResolvedValue(true),
      };

      db.ProductVariant.findOne = vi.fn().mockResolvedValue(mockVariant);
      db.ProductVariant.findByPk = vi.fn().mockResolvedValue(mockVariant);
      db.ProductVariant.sum = vi.fn().mockResolvedValue(10);
      db.Product.update = vi.fn().mockResolvedValue([1]);
      db.sequelize.transaction = vi.fn().mockImplementation(async (callback) => callback({}));
      db.InventoryTransaction.create = vi.fn().mockResolvedValue({});

      const result = await updateProductVariant('prod-1', 'var-1', { stockQty: 10 }, { userId: 'admin-1' });

      expect(mockVariant.update).toHaveBeenCalledWith(expect.objectContaining({ stockQty: 10 }), expect.anything());
      expect(db.InventoryTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ADJUSTMENT',
        qty: 5,
        productId: 'prod-1',
        variantId: 'var-1',
        beforeStock: 5,
        afterStock: 10,
        createdBy: 'admin-1',
      }), expect.anything());
    });

    it('does not create InventoryTransaction when stockQty is unchanged', async () => {
      const mockVariant = {
        id: 'var-1',
        productId: 'prod-1',
        stockQty: 5,
        reservedQty: 0,
        update: vi.fn().mockResolvedValue(true),
      };

      db.ProductVariant.findOne = vi.fn().mockResolvedValue(mockVariant);
      db.ProductVariant.findByPk = vi.fn().mockResolvedValue(mockVariant);
      db.ProductVariant.sum = vi.fn().mockResolvedValue(5);
      db.Product.update = vi.fn().mockResolvedValue([1]);
      db.sequelize.transaction = vi.fn().mockImplementation(async (callback) => callback({}));
      db.InventoryTransaction.create = vi.fn().mockResolvedValue({});

      await updateProductVariant('prod-1', 'var-1', { stockQty: 5 }, { userId: 'admin-1' });

      expect(mockVariant.update).toHaveBeenCalledWith(expect.objectContaining({ stockQty: 5 }), expect.anything());
      expect(db.InventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('records a decrease direction in InventoryTransaction when stock is reduced', async () => {
      const mockVariant = {
        id: 'var-1',
        productId: 'prod-1',
        stockQty: 10,
        reservedQty: 2,
        update: vi.fn().mockResolvedValue(true),
      };

      db.ProductVariant.findOne = vi.fn().mockResolvedValue(mockVariant);
      db.ProductVariant.findByPk = vi.fn().mockResolvedValue(mockVariant);
      db.ProductVariant.sum = vi.fn().mockResolvedValue(4);
      db.Product.update = vi.fn().mockResolvedValue([1]);
      db.sequelize.transaction = vi.fn().mockImplementation(async (callback) => callback({}));
      db.InventoryTransaction.create = vi.fn().mockResolvedValue({});

      await updateProductVariant('prod-1', 'var-1', { stockQty: 4 }, { userId: 'admin-1' });

      expect(mockVariant.update).toHaveBeenCalledWith(expect.objectContaining({ stockQty: 4 }), expect.anything());
      expect(db.InventoryTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ADJUSTMENT',
        qty: 6,
        productId: 'prod-1',
        variantId: 'var-1',
        beforeStock: 10,
        afterStock: 4,
        beforeReserved: 2,
        afterReserved: 2,
        createdBy: 'admin-1',
        metadata: expect.objectContaining({
          direction: 'decrease',
        }),
      }), expect.anything());
    });

    it('throws VALIDATION_ERROR when stockQty is less than reservedQty', async () => {
      const mockVariant = {
        id: 'var-1',
        productId: 'prod-1',
        stockQty: 5,
        reservedQty: 3,
        update: vi.fn(),
      };

      db.ProductVariant.findOne = vi.fn().mockResolvedValue(mockVariant);

      await expect(
        updateProductVariant('prod-1', 'var-1', { stockQty: 2 }, { userId: 'admin-1' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        message: expect.stringContaining('cannot be less than reserved quantity (3)'),
      });

      expect(mockVariant.update).not.toHaveBeenCalled();
    });

    it('allows stockQty to equal reservedQty exactly', async () => {
      const mockVariant = {
        id: 'var-1',
        productId: 'prod-1',
        stockQty: 5,
        reservedQty: 2,
        update: vi.fn().mockResolvedValue(true),
      };

      db.ProductVariant.findOne = vi.fn().mockResolvedValue(mockVariant);
      db.ProductVariant.findByPk = vi.fn().mockResolvedValue(mockVariant);
      db.ProductVariant.sum = vi.fn().mockResolvedValue(2);
      db.Product.update = vi.fn().mockResolvedValue([1]);
      db.sequelize.transaction = vi.fn().mockImplementation(async (callback) => callback({}));
      db.InventoryTransaction.create = vi.fn().mockResolvedValue({});

      await updateProductVariant('prod-1', 'var-1', { stockQty: 2 }, { userId: 'admin-1' });

      expect(mockVariant.update).toHaveBeenCalledWith(expect.objectContaining({ stockQty: 2 }), expect.anything());
      expect(db.InventoryTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ADJUSTMENT',
        qty: 3,
        beforeStock: 5,
        afterStock: 2,
        metadata: expect.objectContaining({ direction: 'decrease' }),
      }), expect.anything());
    });

    it('throws VALIDATION_ERROR when stockQty is negative', async () => {
      const mockVariant = {
        id: 'var-1',
        productId: 'prod-1',
        stockQty: 5,
        reservedQty: 0,
        update: vi.fn(),
      };

      db.ProductVariant.findOne = vi.fn().mockResolvedValue(mockVariant);

      await expect(
        updateProductVariant('prod-1', 'var-1', { stockQty: -1 }, { userId: 'admin-1' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        message: 'Quantity must be a non-negative integer',
      });

      expect(mockVariant.update).not.toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR when stockQty is a decimal or non-integer', async () => {
      const mockVariant = {
        id: 'var-1',
        productId: 'prod-1',
        stockQty: 5,
        reservedQty: 0,
        update: vi.fn(),
      };

      db.ProductVariant.findOne = vi.fn().mockResolvedValue(mockVariant);

      await expect(
        updateProductVariant('prod-1', 'var-1', { stockQty: 3.5 }, { userId: 'admin-1' })
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        message: 'Quantity must be a non-negative integer',
      });

      expect(mockVariant.update).not.toHaveBeenCalled();
    });

    it('coerces valid numeric string stockQty to integer', async () => {
      const mockVariant = {
        id: 'var-1',
        productId: 'prod-1',
        stockQty: 5,
        reservedQty: 0,
        update: vi.fn().mockResolvedValue(true),
      };

      db.ProductVariant.findOne = vi.fn().mockResolvedValue(mockVariant);
      db.ProductVariant.findByPk = vi.fn().mockResolvedValue(mockVariant);
      db.ProductVariant.sum = vi.fn().mockResolvedValue(12);
      db.Product.update = vi.fn().mockResolvedValue([1]);
      db.sequelize.transaction = vi.fn().mockImplementation(async (callback) => callback({}));
      db.InventoryTransaction.create = vi.fn().mockResolvedValue({});

      await updateProductVariant('prod-1', 'var-1', { stockQty: '12' }, { userId: 'admin-1' });

      expect(mockVariant.update).toHaveBeenCalledWith(expect.objectContaining({ stockQty: 12 }), expect.anything());
    });

    it('throws NOT_FOUND when variant does not exist', async () => {
      db.ProductVariant.findOne = vi.fn().mockResolvedValue(null);

      await expect(
        updateProductVariant('prod-1', 'missing-var', { stockQty: 10 })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        statusCode: 404,
      });
    });
  });
});

