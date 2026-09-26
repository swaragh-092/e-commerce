import { describe, it, expect, vi, beforeEach } from 'vitest';
const { uuidCsvParamSchema } = require('../../src/utils/common.validation');
const { generateSlug } = require('../../src/utils/slugify');
const { getBrandBySlugSchema, updateBrandSchema, slugParamSchema } = require('../../src/modules/brand/brand.validation');
const { updateProductAttributeSchema } = require('../../src/modules/attribute/productAttribute.validation');
const { deleteAttribute, removeValue } = require('../../src/modules/attribute/attribute.service');
const { updateProductAttribute } = require('../../src/modules/attribute/productAttribute.service');
const { updateBrand } = require('../../src/modules/brand/brand.service');
const db = require('../../src/modules/index');

describe('Attribute, Brand & Permission Fixes Verification', () => {
  describe('P1 — Category-Attribute CSV UUID Validation (uuidCsvParamSchema)', () => {
    it('accepts a single valid UUID', () => {
      const validUuid = '11111111-1111-4111-8111-111111111111';
      const { error, value } = uuidCsvParamSchema.validate({ id: validUuid });
      expect(error).toBeUndefined();
      expect(value.id).toBe(validUuid);
    });

    it('accepts multiple comma-separated valid UUIDs', () => {
      const uuid1 = '11111111-1111-4111-8111-111111111111';
      const uuid2 = '22222222-2222-4222-8222-222222222222';
      const csv = `${uuid1},${uuid2}`;
      const { error, value } = uuidCsvParamSchema.validate({ id: csv });
      expect(error).toBeUndefined();
      expect(value.id).toBe(csv);
    });

    it('rejects invalid UUIDs in CSV input', () => {
      const validUuid = '11111111-1111-4111-8111-111111111111';
      const { error } = uuidCsvParamSchema.validate({ id: `${validUuid},invalid-uuid` });
      expect(error).toBeDefined();
    });

    it('rejects empty input', () => {
      const { error } = uuidCsvParamSchema.validate({ id: '' });
      expect(error).toBeDefined();
    });
  });

  describe('P2 — Attribute & Value Safe Deletion Guards', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('blocks template deletion with 409 if in use by product attributes', async () => {
      const mockAttr = { id: 'attr-1', destroy: vi.fn() };
      db.AttributeTemplate.findByPk = vi.fn().mockResolvedValue(mockAttr);
      db.ProductAttribute.count = vi.fn().mockResolvedValue(3);
      db.VariantOption.count = vi.fn().mockResolvedValue(0);

      await expect(deleteAttribute('attr-1')).rejects.toThrow(/in use by 3 product attribute\(s\)/);
      expect(mockAttr.destroy).not.toHaveBeenCalled();
    });

    it('blocks template deletion with 409 if in use by variant options', async () => {
      const mockAttr = { id: 'attr-1', destroy: vi.fn() };
      db.AttributeTemplate.findByPk = vi.fn().mockResolvedValue(mockAttr);
      db.ProductAttribute.count = vi.fn().mockResolvedValue(0);
      db.VariantOption.count = vi.fn().mockResolvedValue(5);

      await expect(deleteAttribute('attr-1')).rejects.toThrow(/in use by 0 product attribute\(s\) and 5 variant option\(s\)/);
      expect(mockAttr.destroy).not.toHaveBeenCalled();
    });

    it('allows template deletion when not in use', async () => {
      const mockAttr = { id: 'attr-1', destroy: vi.fn().mockResolvedValue(true) };
      db.AttributeTemplate.findByPk = vi.fn().mockResolvedValue(mockAttr);
      db.ProductAttribute.count = vi.fn().mockResolvedValue(0);
      db.VariantOption.count = vi.fn().mockResolvedValue(0);

      await deleteAttribute('attr-1');
      expect(mockAttr.destroy).toHaveBeenCalled();
    });

    it('blocks value removal with 409 if in use by product attributes or variant options', async () => {
      const mockVal = { id: 'val-1', attributeId: 'attr-1', destroy: vi.fn() };
      db.AttributeValue.findOne = vi.fn().mockResolvedValue(mockVal);
      db.ProductAttribute.count = vi.fn().mockResolvedValue(2);
      db.VariantOption.count = vi.fn().mockResolvedValue(4);

      await expect(removeValue('attr-1', 'val-1')).rejects.toThrow(/in use by 2 product attribute\(s\) and 4 variant option\(s\)/);
      expect(mockVal.destroy).not.toHaveBeenCalled();
    });

    it('allows value removal when not in use', async () => {
      const mockVal = { id: 'val-1', attributeId: 'attr-1', destroy: vi.fn().mockResolvedValue(true) };
      db.AttributeValue.findOne = vi.fn().mockResolvedValue(mockVal);
      db.ProductAttribute.count = vi.fn().mockResolvedValue(0);
      db.VariantOption.count = vi.fn().mockResolvedValue(0);

      await removeValue('attr-1', 'val-1');
      expect(mockVal.destroy).toHaveBeenCalled();
    });
  });

  describe('P2 & P3 — Brand Validation & Pagination / Sorting', () => {
    it('getBrandBySlugSchema allows productOffset, productSortBy, and productSortOrder', () => {
      const { error, value } = getBrandBySlugSchema.validate({
        productLimit: 10,
        productOffset: 20,
        productSortBy: 'price',
        productSortOrder: 'DESC',
      });
      expect(error).toBeUndefined();
      expect(value.productLimit).toBe(10);
      expect(value.productOffset).toBe(20);
      expect(value.productSortBy).toBe('price');
      expect(value.productSortOrder).toBe('DESC');
    });

    it('updateBrandSchema rejects empty payload with min(1)', () => {
      const { error } = updateBrandSchema.validate({});
      expect(error).toBeDefined();
      expect(error.message).toMatch(/At least one field is required to update/);
    });

    it('updateBrandSchema accepts single field update', () => {
      const { error, value } = updateBrandSchema.validate({ name: 'Acme Corp' });
      expect(error).toBeUndefined();
      expect(value.name).toBe('Acme Corp');
    });

    it('slugParamSchema accepts both hyphens and underscores', () => {
      const hyphenResult = slugParamSchema.validate({ slug: 'nike-running' });
      expect(hyphenResult.error).toBeUndefined();

      const underscoreResult = slugParamSchema.validate({ slug: 'nike_running' });
      expect(underscoreResult.error).toBeUndefined();

      const invalidResult = slugParamSchema.validate({ slug: 'nike/running' });
      expect(invalidResult.error).toBeDefined();
    });
  });

  describe('P3 — Brand Rename Auto-Regenerates Slug', () => {
    it('regenerates slug when brand name changes and no explicit slug provided', async () => {
      const mockBrand = {
        id: 'brand-1',
        name: 'Nike',
        slug: 'nike',
        update: vi.fn().mockResolvedValue(true),
      };

      const mockTx = { commit: vi.fn(), rollback: vi.fn() };
      db.Brand.sequelize = { transaction: vi.fn().mockResolvedValue(mockTx) };
      db.Brand.findByPk = vi.fn().mockResolvedValue(mockBrand);
      db.Brand.findOne = vi.fn().mockResolvedValue(null); // No slug collision

      await updateBrand('brand-1', { name: 'Nike Running' });

      expect(mockBrand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nike Running',
          slug: 'nike-running',
        }),
        expect.any(Object)
      );
      expect(mockTx.commit).toHaveBeenCalled();
    });
  });

  describe('P3 — Product Attribute Mixed-Mode Validation & Service Checks', () => {
    it('updateProductAttributeSchema rejects both valueId and customValue', () => {
      const { error } = updateProductAttributeSchema.validate({
        valueId: '11111111-1111-4111-8111-111111111111',
        customValue: 'XL',
      });
      expect(error).toBeDefined();
      expect(error.message).toMatch(/Cannot provide both valueId and customValue/);
    });

    it('service rejects valueId on a custom attribute row', async () => {
      const mockRow = {
        id: 'row-1',
        productId: 'prod-1',
        attributeId: null, // custom attribute
        customName: 'Special Note',
        customValue: 'Handmade',
        update: vi.fn(),
      };
      db.ProductAttribute.findOne = vi.fn().mockResolvedValue(mockRow);

      await expect(
        updateProductAttribute('prod-1', 'row-1', {
          valueId: '11111111-1111-4111-8111-111111111111',
        })
      ).rejects.toThrow(/Cannot set valueId on a custom attribute/);
    });

    it('service rejects customValue on a global attribute template row', async () => {
      const mockRow = {
        id: 'row-1',
        productId: 'prod-1',
        attributeId: 'attr-1', // global template
        valueId: 'val-1',
        update: vi.fn(),
      };
      db.ProductAttribute.findOne = vi.fn().mockResolvedValue(mockRow);

      await expect(
        updateProductAttribute('prod-1', 'row-1', {
          customValue: 'Blue',
        })
      ).rejects.toThrow(/Cannot set customValue on a global attribute template/);
    });
  });

  describe('P3 — Slug Generation Normalization & Scoped Where Support', () => {
    it('converts underscores to hyphens in slugify', async () => {
      const slug = await generateSlug('T_Shirt');
      expect(slug).toBe('t-shirt');
    });

    it('supports options.where in collision check', async () => {
      const mockModel = {
        findOne: vi.fn().mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null),
      };

      const slug = await generateSlug('Red', mockModel, 'slug', {
        where: { attributeId: 'color-attr' },
      });

      expect(slug).toBe('red-1');
      expect(mockModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            slug: 'red',
            attributeId: 'color-attr',
          }),
        })
      );
    });
  });

  describe('Brand — isFeatured validation, query, and UI coverage', () => {
    const { queryBrandSchema, createBrandSchema, updateBrandSchema } = require('../../src/modules/brand/brand.validation');

    it('queryBrandSchema accepts isFeatured boolean', () => {
      const resTrue = queryBrandSchema.validate({ isFeatured: 'true' });
      expect(resTrue.error).toBeUndefined();
      expect(resTrue.value.isFeatured).toBe(true);

      const resFalse = queryBrandSchema.validate({ isFeatured: 'false' });
      expect(resFalse.error).toBeUndefined();
      expect(resFalse.value.isFeatured).toBe(false);
    });

    it('createBrandSchema and updateBrandSchema accept isFeatured', () => {
      const createRes = createBrandSchema.validate({ name: 'Featured Brand', isFeatured: true });
      expect(createRes.error).toBeUndefined();
      expect(createRes.value.isFeatured).toBe(true);

      const updateRes = updateBrandSchema.validate({ isFeatured: true });
      expect(updateRes.error).toBeUndefined();
      expect(updateRes.value.isFeatured).toBe(true);
    });

    it('BrandsPage.jsx source contains isFeatured controls, columns, and filter', () => {
      const fs = require('fs');
      const path = require('path');
      const src = fs.readFileSync(
        path.join(__dirname, '../../../client/src/pages/admin/BrandsPage.jsx'),
        'utf8'
      );
      expect(src).toContain("field: 'isFeatured'");
      expect(src).toContain('featuredFilter');
      expect(src).toContain('isFeatured:');
      expect(src).toContain('label="Featured brand"');
    });
  });
});



