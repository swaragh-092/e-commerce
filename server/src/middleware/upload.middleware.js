'use strict';

const multer = require('multer');
const path = require('path');
const AppError = require('../utils/AppError');
const crypto = require('crypto');

// Get upload directory from env or default
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Generate UUID or random string instead of original name
    const ext = path.extname(file.originalname);
    const id = crypto.randomUUID();
    cb(null, `${id}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Check basic extension mapping first, but we'll use file-type inside the media service for true validation
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('INVALID_FILE_TYPE', 400, 'Only JPEG, PNG, WebP, and GIF images are allowed. SVGs are rejected.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024 // default 5MB
  },
  fileFilter: fileFilter
});

module.exports = { upload };
