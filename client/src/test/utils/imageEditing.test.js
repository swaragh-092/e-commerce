import { describe, expect, it } from 'vitest';
import { centeredCrop, cropPixels, outputSize, rotatedSize } from '../../utils/imageEditing';

describe('media crop geometry', () => {
  it('centers a product square without stretching a landscape image', () => {
    const crop = cropPixels(centeredCrop(1800, 1200, 1), { width: 1800, height: 1200 });
    expect(crop).toEqual({ x: 300, y: 0, width: 1200, height: 1200 });
  });
  it('crops a desktop banner and mobile banner to their intended aspect ratios', () => {
    const size = { width: 2400, height: 1600 };
    expect(cropPixels(centeredCrop(2400, 1600, 3), size)).toEqual({ x: 0, y: 400, width: 2400, height: 800 });
    expect(cropPixels(centeredCrop(2400, 1600, 0.75), size)).toEqual({ x: 600, y: 0, width: 1200, height: 1600 });
  });
  it('keeps crop coordinates in bounds at the right and bottom edges', () => {
    expect(cropPixels({ x: 99.9, y: 99.9, width: 1, height: 1 }, { width: 101, height: 51 }))
      .toEqual({ x: 100, y: 50, width: 1, height: 1 });
  });
  it('never enlarges small images and keeps proportional height', () => {
    expect(outputSize({ width: 320, height: 160 }, 1920)).toEqual({ width: 320, height: 160 });
    expect(outputSize({ width: 2400, height: 800 }, 1200)).toEqual({ width: 1200, height: 400 });
  });
  it('caps tall output at 4096 pixels', () => {
    expect(outputSize({ width: 2000, height: 8000 }, 2000)).toEqual({ width: 1024, height: 4096 });
  });
  it('swaps dimensions for quarter turns and preserves dimensions for half turns', () => {
    expect(rotatedSize(1200, 800, 90)).toEqual({ width: 800, height: 1200 });
    expect(rotatedSize(1200, 800, 270)).toEqual({ width: 800, height: 1200 });
    expect(rotatedSize(1200, 800, 180)).toEqual({ width: 1200, height: 800 });
  });
});

// Presets must use each source's own dimensions rather than a shared pixel crop.
describe('bulk preset sizing', () => {
  it('uses a different source crop for portrait and landscape files', async () => {
    const { presetEdit } = await import('../../utils/imageEditing');
    const landscape = presetEdit({ width: 1800, height: 1200 }, 'product');
    const portrait = presetEdit({ width: 800, height: 1200 }, 'product');
    expect(landscape.width).toBe(1200);
    expect(portrait.width).toBe(800);
    expect(landscape.crop.x).toBeGreaterThan(0);
    expect(portrait.crop.y).toBeGreaterThan(0);
  });
  it('does not upscale a small mobile banner source', async () => {
    const { presetEdit } = await import('../../utils/imageEditing');
    const edit = presetEdit({ width: 300, height: 400 }, 'mobile');
    expect(edit.width).toBe(300);
    expect(edit.crop).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
  });
});

describe('custom crop preset geometry', () => {
  it('applies the saved ratio and max size while keeping its definition with the crop', async () => {
    const { presetEdit } = await import('../../utils/imageEditing');
    const definition = { id: 'custom:portrait', label: 'Portrait', width: 800, height: 1000, ratio: 0.8 };
    const edit = presetEdit({ width: 1800, height: 1200 }, definition.id, [definition]);
    expect(edit.width).toBe(800);
    expect(edit.presetDefinition).toEqual(definition);
    expect(edit.presetDefinition).not.toBe(definition);
    expect(cropPixels(edit.crop, { width: 1800, height: 1200 })).toMatchObject({ width: 960, height: 1200 });
  });
});
