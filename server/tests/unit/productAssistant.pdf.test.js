import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import zlib from 'zlib';

const require = createRequire(import.meta.url);
const { extractTextFromPdfBuffer } = require('../../src/modules/productAssistant/productAssistant.pdf');

describe('product assistant pdf extraction', () => {
  it('extracts text from a flate-compressed PDF content stream', () => {
    const stream = 'BT /F1 12 Tf 72 720 Td (Apple iPhone 16 Pro 256GB Natural Titanium) Tj ET';
    const compressed = zlib.deflateSync(Buffer.from(stream, 'latin1'));
    const pdf = Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`, 'latin1');
    const suffix = Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1');
    const buffer = Buffer.concat([pdf, compressed, suffix]);

    const text = extractTextFromPdfBuffer(buffer);
    expect(text).toContain('Apple iPhone 16 Pro 256GB Natural Titanium');
  });
});
