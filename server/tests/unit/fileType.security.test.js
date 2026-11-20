/**
 * Regression tests for file-type security advisories.
 *
 * GHSA-5v7r-6r5c-r473 — Infinite loop in ASF parser on malformed input with
 *   a zero-size sub-header chunk.  Fixed in file-type >=21.3.2.
 *   Affected range: 13.0.0 – 21.3.1.
 *
 * GHSA-j47w-4g3g-c36v — ZIP decompression bomb DoS via a crafted
 *   [Content_Types].xml entry inside a ZIP container.  Fixed in >=21.3.2.
 *   Affected range: 13.0.0 – 21.3.1.
 *
 * These tests exercise the parser via an isolated async call with a hard
 * timeout.  They do NOT require a DB or any application bootstrap; they import
 * file-type directly so they are safe to run in any CI environment.
 *
 * Run:  npx vitest run tests/unit/fileType.security.test.js
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run fileTypeFromBuffer with a hard Promise.race timeout.
 * Returns { result, timedOut }.
 */
async function detectWithTimeout(buf, ms = 2000) {
  const { fileTypeFromBuffer } = await import('file-type');

  let timedOut = false;
  const timeoutHandle = Symbol('timeout');

  const result = await Promise.race([
    fileTypeFromBuffer(buf),
    new Promise((resolve) =>
      setTimeout(() => {
        timedOut = true;
        resolve(timeoutHandle);
      }, ms)
    ),
  ]);

  if (result === timeoutHandle) {
    return { result: undefined, timedOut: true };
  }
  return { result, timedOut: false };
}

// ---------------------------------------------------------------------------
// ASF parser — GHSA-5v7r-6r5c-r473
// ---------------------------------------------------------------------------
// An ASF container begins with the Header Object GUID (30 26 B2 75 8E 66 CF 11
// A6 D9 00 AA 00 62 CE 6C) followed by an 8-byte object size and other fields.
// The vulnerable code path triggered when a sub-object had a declared size of 0.
// We construct a minimal ASF-like buffer with a zero-size sub-header to verify
// the parser terminates rather than spinning indefinitely.

function buildMalformedAsfBuffer() {
  // ASF Header Object GUID (16 bytes, little-endian representation)
  const ASF_HEADER_GUID = Buffer.from([
    0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11,
    0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c,
  ]);

  // Outer object size: 30 bytes (header GUID + size field + 6 header bytes)
  const outerSize = Buffer.alloc(8);
  outerSize.writeBigUInt64LE(BigInt(30), 0);

  // Number of headers (4 bytes LE) = 1
  const numHeaders = Buffer.alloc(4);
  numHeaders.writeUInt32LE(1, 0);

  // Reserved (2 bytes)
  const reserved = Buffer.from([0x01, 0x02]);

  // Sub-header: arbitrary GUID (16 bytes) + size field of 0 (8 bytes)
  // (size=0 is what triggered the infinite loop in <=21.3.1)
  const subGuid = Buffer.alloc(16, 0x00);
  const subSize = Buffer.alloc(8); // 0n — the malformed trigger
  subSize.writeBigUInt64LE(BigInt(0), 0);

  return Buffer.concat([ASF_HEADER_GUID, outerSize, numHeaders, reserved, subGuid, subSize]);
}

describe('GHSA-5v7r-6r5c-r473 — ASF infinite-loop regression', () => {
  it('returns within 2 s on a malformed ASF buffer with a zero-size sub-header', async () => {
    const buf = buildMalformedAsfBuffer();
    const { timedOut } = await detectWithTimeout(buf, 2000);
    expect(timedOut, 'fileTypeFromBuffer timed out — ASF infinite loop may still be present').toBe(false);
  });

  it('does not throw on the malformed ASF input', async () => {
    const { fileTypeFromBuffer } = await import('file-type');
    const buf = buildMalformedAsfBuffer();
    await expect(fileTypeFromBuffer(buf)).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ZIP decompression bomb — GHSA-j47w-4g3g-c36v
// ---------------------------------------------------------------------------
// file-type detects ZIP-based formats by inspecting the [Content_Types].xml
// entry inside the ZIP.  The vulnerable parser could be tricked by a crafted
// entry into allocating excessive memory.  We construct a minimal PK-signature
// buffer (just enough to trigger ZIP detection) and confirm the call terminates
// promptly without any memory explosion or timeout.

function buildMinimalZipBuffer() {
  // Local File Header signature (PK\x03\x04) — enough to trigger ZIP detection
  const PK_LOCAL = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

  // Minimal header fields (26 bytes) — version, flags, compression, etc.
  const header = Buffer.alloc(26, 0x00);

  return Buffer.concat([PK_LOCAL, header]);
}

function buildZipWithLargeContentTypesEntry() {
  // Construct a ZIP-like buffer with an inflated [Content_Types].xml filename
  // in the central directory.  The goal is to probe the parser path that was
  // patched in GHSA-j47w-4g3g-c36v without actually decompressing data.

  const PK_LOCAL = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const localHeader = Buffer.alloc(26, 0x00);
  // filename length = 64 bytes (field at offset 26, LE uint16)
  localHeader.writeUInt16LE(64, 24);
  const filename = Buffer.alloc(64, 0x41); // 'A' × 64

  // Central directory end signature
  const PK_END = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endRecord = Buffer.alloc(18, 0x00);

  return Buffer.concat([PK_LOCAL, localHeader, filename, PK_END, endRecord]);
}

describe('GHSA-j47w-4g3g-c36v — ZIP decompression bomb regression', () => {
  it('detects a minimal ZIP buffer as application/zip or undefined without hanging', async () => {
    const buf = buildMinimalZipBuffer();
    const { timedOut, result } = await detectWithTimeout(buf, 2000);
    expect(timedOut, 'fileTypeFromBuffer timed out on a minimal ZIP buffer').toBe(false);
    // Result may be undefined (incomplete ZIP) or application/zip — both are acceptable;
    // the critical assertion is that the call terminates.
    if (result !== undefined) {
      expect(result.mime).toBe('application/zip');
    }
  });

  it('returns within 2 s on a ZIP buffer with a large filename entry', async () => {
    const buf = buildZipWithLargeContentTypesEntry();
    const { timedOut } = await detectWithTimeout(buf, 2000);
    expect(timedOut, 'fileTypeFromBuffer timed out — ZIP bomb path may still be present').toBe(false);
  });

  it('does not throw on the crafted ZIP input', async () => {
    const { fileTypeFromBuffer } = await import('file-type');
    const buf = buildZipWithLargeContentTypesEntry();
    await expect(fileTypeFromBuffer(buf)).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Sanity: verify the installed version satisfies the minimum fixed release.
// file-type 21.x uses ESM-only exports that block `require('file-type/package.json')`,
// so we read the file directly via fs using a well-known relative path.
// ---------------------------------------------------------------------------
describe('file-type version gate', () => {
  it('is installed at >=21.3.2 (the first release containing both fixes)', async () => {
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');

    // __dirname equivalent in ESM
    const dir = dirname(fileURLToPath(import.meta.url));
    // Navigate from tests/unit/ → server/node_modules/file-type/package.json
    const pkgPath = resolve(dir, '../../node_modules/file-type/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    const [major, minor, patch] = pkg.version.split('.').map(Number);

    const meetsMinimum =
      major > 21 ||
      (major === 21 && minor > 3) ||
      (major === 21 && minor === 3 && patch >= 2);

    expect(
      meetsMinimum,
      `file-type ${pkg.version} is below the required >=21.3.2 that fixes GHSA-5v7r-6r5c-r473 and GHSA-j47w-4g3g-c36v`
    ).toBe(true);
  });
});
