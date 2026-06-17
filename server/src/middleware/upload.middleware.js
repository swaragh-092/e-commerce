'use strict';

const multer = require('multer');
const AppError = require('../utils/AppError');

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

const createMemoryUpload = ({
  allowedMimeTypes,
  maxFileSizeMb,
  errorMessage,
}) =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
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

const documentMemoryUpload = createMemoryUpload({
  allowedMimeTypes: ['application/pdf'],
  maxFileSizeMb:
    parseInt(process.env.MAX_DOCUMENT_FILE_SIZE_MB, 10) || 10,
  errorMessage: 'Only PDF documents are allowed.',
});

const fontUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
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