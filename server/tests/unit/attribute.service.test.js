import { describe, it, expect, vi, beforeEach } from 'vitest';
const { getAttributesQuerySchema } = require('../../src/modules/attribute/attribute.validation');
const db = require('../../src/modules/index');
const { getAllAttributes } = require('../../src/modules/attribute/attribute.service');

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
});
