'use strict';

const multer = require('multer');
const AppError = require('../utils/AppError');

// ---------------------------------------------------------------------------
// Multipart hard limits (all passed to busboy via multer)
//
// These defend against resource-exhaustion attacks that bypass fileSize alone:
//
//  fieldNestingDepth      (multer >=2.3.0 / busboy >=1.6.0)
//    Caps deeply-nested JSON-path keys like a[b][c][d]… which would otherwise
//    trigger quadratic memory growth while building the nested object in busboy.
//
//  fieldArrayIndexLimit   (multer >=2.3.0 / busboy >=1.6.0)
//    Rejects suspiciously large numeric array indices in field names.
//
//  fields     Max number of non-file text fields per multipart request.
//  parts      Total parts (fields + files) per request.
//  headerPairs  Max HTTP header key/value pairs forwarded to busboy.
//
// Per-upload fileSize limits are set individually on each multer instance below
// so image, document, and font uploads each enforce the right cap independently.
// ---------------------------------------------------------------------------
const SHARED_LIMITS = {
  fieldNestingDepth: 3,       // a[b][c] is depth 2; 3 covers reasonable form nesting
  fieldArrayIndexLimit: 100,  // reject huge indices before any allocation
  fields: 20,                 // generous for multi-field forms; blocks field-flood attacks
  parts: 22,                  // fields + files combined (allows 1–2 files alongside text fields)
  headerPairs: 200,           // busboy default is 2000; tighter for upload routes
};

// ---------------------------------------------------------------------------
// Font file filter — declared MIME-type + extension early-reject.
// Authoritative binary validation (magic bytes) is performed in
// media.service.js via file-type; this filter is just a fast first gate.
// ---------------------------------------------------------------------------
const fontFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'font/woff2',
    'font/woff',
    'font/ttf',
    'font/otf',
    'application/font-woff2',
    'application/font-woff',
    'application/x-font-ttf',
    'application/x-font-opentype',
    'application/vnd.ms-fontobject',
  ];

  const allowedExtensions = ['.woff2', '.woff', '.ttf', '.otf'];

  const ext = (file.originalname || '')
    .slice((file.originalname || '').lastIndexOf('.'))
    .toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    allowedExtensions.includes(ext)
  ) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'INVALID_FILE_TYPE',
        400,
        'Only WOFF2, WOFF, TTF, and OTF font files are allowed.'
      ),
      false
    );
  }
};

// ---------------------------------------------------------------------------
// Factory — creates a multer instance with all shared multipart limits plus a
// per-type fileSize cap and MIME-type allow-list.
// ---------------------------------------------------------------------------
const createMemoryUpload = ({
  allowedMimeTypes,
  maxFileSizeMb,
  errorMessage,
}) =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      ...SHARED_LIMITS,
      // Single-file endpoints: block more than one file field per request.
      files: 1,
      fileSize: maxFileSizeMb * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
        return;
      }

      cb(
        new AppError(
          'INVALID_FILE_TYPE',
          400,
          errorMessage
        ),
        false
      );
    },
  });

// ---------------------------------------------------------------------------
// Image upload — JPEG / PNG / WebP / GIF; SVG explicitly rejected.
// ---------------------------------------------------------------------------
const memoryUpload = createMemoryUpload({
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ],
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
  errorMessage:
    'Only JPEG, PNG, WebP, and GIF images are allowed. SVGs are rejected.',
});

// ---------------------------------------------------------------------------
// Document upload — PDF only.
// ---------------------------------------------------------------------------
const documentMemoryUpload = createMemoryUpload({
  allowedMimeTypes: ['application/pdf'],
  maxFileSizeMb:
    parseInt(process.env.MAX_DOCUMENT_FILE_SIZE_MB, 10) || 10,
  errorMessage: 'Only PDF documents are allowed.',
});

// ---------------------------------------------------------------------------
// Font upload — uses dedicated font filter; binary validation in service.
// ---------------------------------------------------------------------------
const fontUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    ...SHARED_LIMITS,
    files: 1,
    fileSize:
      (parseInt(process.env.MAX_FONT_SIZE_MB, 10) || 10) *
      1024 *
      1024,
  },
  fileFilter: fontFileFilter,
});

module.exports = {
  memoryUpload,
  documentMemoryUpload,
  fontUpload,
};