'use strict';

const multer = require('multer');
const AppError = require('../utils/AppError');


const createMemoryUpload = ({ allowedMimeTypes, maxFileSizeMb, errorMessage }) => multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new AppError('INVALID_FILE_TYPE', 400, errorMessage), false);
  },
});

const memoryUpload = createMemoryUpload({
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
  errorMessage: 'Only JPEG, PNG, WebP, and GIF images are allowed. SVGs are rejected.',
});

const documentMemoryUpload = createMemoryUpload({
  allowedMimeTypes: ['application/pdf'],
  maxFileSizeMb: parseInt(process.env.MAX_DOCUMENT_FILE_SIZE_MB, 10) || 10,
  errorMessage: 'Only PDF documents are allowed.',
});

module.exports = { memoryUpload, documentMemoryUpload };

