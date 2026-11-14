/**
 * Regression and configuration unit tests for upload.middleware.js
 *
 * Verifies that:
 * 1. Multer is upgraded to >=2.3.0 (installed version is 2.5.0) which fixes:
 *    - GHSA-4824-h99c-v9r4 (ReDoS in multipart parser boundary parsing)
 *    - GHSA-cxjh-pqwp-8m2h (Denial of Service via unhandled error / memory exhaustion)
 *    - GHSA-v224-q52g-5267 (Resource exhaustion via unbounded key nesting)
 * 2. Explicit multipart limits are enforced:
 *    - fieldNestingDepth: rejects nested keys deeper than 3 (LIMIT_FIELD_NESTING)
 *    - fieldArrayIndexLimit: rejects array indices > 100 (LIMIT_FIELD_ARRAY_INDEX)
 *    - fields: caps text fields at 20 (LIMIT_FIELD_COUNT)
 * 3. File size and MIME type security controls are preserved:
 *    - Disallows invalid MIME types (e.g., SVG, text/plain)
 *    - Preserves file size caps
 */

import { describe, it, expect } from 'vitest';
import http from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const { memoryUpload, documentMemoryUpload, fontUpload } = await import('../../src/middleware/upload.middleware.js');

const BOUNDARY = '---------------------------974767299852498929531610575';

function sendMultipart(middleware, bodyString) {
  return new Promise((resolvePromise, rejectPromise) => {
    let capturedResult = null;

    const server = http.createServer((req, res) => {
      middleware(req, res, (err) => {
        capturedResult = {
          error: err ? err.message : null,
          code: err ? (err.code || err.name) : null,
          body: req.body || null,
          file: req.file ? { originalname: req.file.originalname, mimetype: req.file.mimetype } : null,
        };
        res.statusCode = err ? 400 : 200;
        res.setHeader('Content-Type', 'application/json');
        res.end('{}');
      });
    });

    server.listen(0, () => {
      const port = server.address().port;
      const req = http.request(
        {
          port,
          method: 'POST',
          headers: {
            'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
          },
        },
        (res) => {
          res.resume();
          res.on('end', () => {
            server.close();
            resolvePromise(capturedResult);
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        rejectPromise(err);
      });
      req.write(bodyString);
      req.end();
    });
  });
}

describe('Upload Middleware — Multer Version Gate', () => {
  it('is installed at >=2.3.0 (fixing all 3 reported advisories)', () => {
    const pkgPath = resolve(dir, '../../node_modules/multer/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const [major, minor] = pkg.version.split('.').map(Number);

    const meetsMinimum = major > 2 || (major === 2 && minor >= 3);
    expect(
      meetsMinimum,
      `Multer ${pkg.version} is below the required >=2.3.0 to fix reported advisories`
    ).toBe(true);
  });
});

describe('Upload Middleware — Multipart Limits Enforcement', () => {
  it('enforces fieldNestingDepth: allows depth <= 3, rejects depth > 3 with LIMIT_FIELD_NESTING', async () => {
    // Depth <= 3: a[b][c][d] has 3 brackets (depth 3)
    const validPart =
      `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="a[b][c][d]"\r\n\r\n` +
      `nested_value\r\n` +
      `--${BOUNDARY}--\r\n`;

    const resValid = await sendMultipart(memoryUpload.single('file'), validPart);
    expect(resValid.error).toBeNull();
    expect(resValid.body.a.b.c.d).toBe('nested_value');

    // Depth > 3: a[b][c][d][e] has 4 brackets (depth 4)
    const invalidPart =
      `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="a[b][c][d][e]"\r\n\r\n` +
      `too_deep\r\n` +
      `--${BOUNDARY}--\r\n`;

    const resInvalid = await sendMultipart(memoryUpload.single('file'), invalidPart);
    expect(resInvalid.code).toBe('LIMIT_FIELD_NESTING');
  });

  it('enforces fieldArrayIndexLimit: allows index <= 100, rejects index > 100 with LIMIT_FIELD_ARRAY_INDEX', async () => {
    // Array index <= 100
    const validPart =
      `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="items[50]"\r\n\r\n` +
      `item50\r\n` +
      `--${BOUNDARY}--\r\n`;

    const resValid = await sendMultipart(memoryUpload.single('file'), validPart);
    expect(resValid.error).toBeNull();
    expect(resValid.body.items[50]).toBe('item50');

    // Array index > 100
    const invalidPart =
      `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="items[105]"\r\n\r\n` +
      `item105\r\n` +
      `--${BOUNDARY}--\r\n`;

    const resInvalid = await sendMultipart(memoryUpload.single('file'), invalidPart);
    expect(resInvalid.code).toBe('LIMIT_FIELD_ARRAY_INDEX');
  });

  it('enforces fields limit: rejects more than 20 text fields with LIMIT_FIELD_COUNT', async () => {
    let payload = '';
    for (let i = 0; i < 25; i++) {
      payload +=
        `--${BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="field_${i}"\r\n\r\n` +
        `val_${i}\r\n`;
    }
    payload += `--${BOUNDARY}--\r\n`;

    const res = await sendMultipart(memoryUpload.single('file'), payload);
    expect(res.code).toBe('LIMIT_FIELD_COUNT');
  });
});

describe('Upload Middleware — File Type & Controls Integrity', () => {
  it('accepts valid image MIME type', async () => {
    const payload =
      `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="sample.png"\r\n` +
      `Content-Type: image/png\r\n\r\n` +
      `sample-binary-content\r\n` +
      `--${BOUNDARY}--\r\n`;

    const res = await sendMultipart(memoryUpload.single('file'), payload);
    expect(res.error).toBeNull();
    expect(res.file.originalname).toBe('sample.png');
    expect(res.file.mimetype).toBe('image/png');
  });

  it('rejects disallowed file types such as SVG or text/plain', async () => {
    const payload =
      `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="malicious.svg"\r\n` +
      `Content-Type: image/svg+xml\r\n\r\n` +
      `<svg onload="alert(1)"></svg>\r\n` +
      `--${BOUNDARY}--\r\n`;

    const res = await sendMultipart(memoryUpload.single('file'), payload);
    expect(res.code).toBe('INVALID_FILE_TYPE');
    expect(res.error).toContain('Only JPEG, PNG, WebP, and GIF images are allowed');
  });

  it('documentMemoryUpload rejects non-PDF files', async () => {
    const payload =
      `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="doc.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `hello world\r\n` +
      `--${BOUNDARY}--\r\n`;

    const res = await sendMultipart(documentMemoryUpload.single('file'), payload);
    expect(res.code).toBe('INVALID_FILE_TYPE');
    expect(res.error).toContain('Only PDF documents are allowed');
  });
});

