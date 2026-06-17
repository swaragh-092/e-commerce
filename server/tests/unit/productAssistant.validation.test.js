import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { generateDraftSchema } = require('../../src/modules/productAssistant/productAssistant.validation');

describe('product assistant validation', () => {
  it('accepts valid draft generation input', () => {
    const { error, value } = generateDraftSchema.validate({
      input: 'Apple iPhone 16 Pro 256GB Natural Titanium',
    });

    expect(error).toBeUndefined();
    expect(value.tone).toBe('neutral');
    expect(value.maxFeatureBullets).toBe(5);
  });

  it('rejects empty draft generation input', () => {
    const { error } = generateDraftSchema.validate({ input: '' });
    expect(error).toBeDefined();
  });
});
