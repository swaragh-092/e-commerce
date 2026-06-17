'use strict';

const multer = require('multer');
const AppError = require('../utils/AppError');


const fileFilter = (req, file, cb) => {
  // Check basic extension mapping first, but we'll use file-type inside the media service for true validation
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('INVALID_FILE_TYPE', 400, 'Only JPEG, PNG, WebP, and GIF images are allowed. SVGs are rejected.'), false);
  }
};

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
  const ext = (file.originalname || '').slice((file.originalname || '').lastIndexOf('.')).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('INVALID_FILE_TYPE', 400, 'Only WOFF2, WOFF, TTF, and OTF font files are allowed.'), false);
  }
};

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024 // default 5MB
  },
  fileFilter: fileFilter
});

const fontUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (parseInt(process.env.MAX_FONT_SIZE_MB) || 10) * 1024 * 1024 // default 10MB for fonts
  },
  fileFilter: fontFileFilter
});

module.exports = { memoryUpload, fontUpload };

