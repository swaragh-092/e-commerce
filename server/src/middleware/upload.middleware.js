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

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024 // default 5MB
  },
  fileFilter: fileFilter
});

module.exports = { memoryUpload };

