import { describe, expect, it } from 'vitest';
import { inferValueType, resolveAttributePresentation } from '../../utils/attributePresentation';

describe('attribute presentation rules', () => {
  it.each([
    ['Colour', 'color', 'swatch'], ['Print', 'pattern', 'swatch'],
    ['Shoe size', 'size', 'button'], ['Net weight', 'weight', 'button'],
    ['Diameter', 'length', 'button'], ['RAM', 'storage', 'button'],
    ['Bottle volume', 'volume', 'button'], ['Fabric', 'material', 'chip'],
    ['Finish', 'text', 'chip'], ['Ceramic', 'text', 'chip'],
  ])('detects %s as %s with %s options', (name, valueType, displayType) => {
    expect(resolveAttributePresentation({ attribute: { name }, values: [] })).toEqual({ valueType, displayType });
  });
  it('honors an explicit type even when the name suggests another', () => {
    expect(inferValueType({ name: 'Color', valueType: 'text' })).toBe('text');
    expect(inferValueType({ name: 'Finish', slug: 'fabric_finish' })).toBe('material');
  });
  it('uses images before type, and type before option count', () => {
    const values = Array.from({ length: 9 }, (_, id) => ({ id, value: String(id) }));
    expect(resolveAttributePresentation({ attribute: { name: 'Finish' }, values }).displayType).toBe('dropdown');
    expect(resolveAttributePresentation({ attribute: { name: 'Size' }, values }).displayType).toBe('button');
    expect(resolveAttributePresentation({ attribute: { name: 'Color' }, values: [{ imageUrl: '/sample.jpg' }] }).displayType).toBe('image');
  });
  it.each(['swatch', 'image', 'button', 'chip', 'radio', 'dropdown', 'text'])('honors explicit %s display', (displayType) => {
    expect(resolveAttributePresentation({ attribute: { name: 'Color', displayType }, values: [{ imageUrl: '/sample.jpg' }] }).displayType).toBe(displayType);
  });
});
