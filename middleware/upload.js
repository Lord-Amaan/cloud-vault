const multer = require('multer');
const path = require('path');

/**
 * Multer Memory Storage Configuration:
 * Keeps file buffer in RAM (file.buffer) rather than writing to ephemeral container disk.
 *
 * Rules:
 * 1. Storage: multer.memoryStorage()
 * 2. Whitelist: PDF, PNG, JPG, JPEG, MP4
 * 3. Size Limit: 10 MB (10 * 1024 * 1024 bytes)
 */
const storage = multer.memoryStorage();

// Allowed file extensions and MIME types
const ALLOWED_EXTENSIONS = /^\.(pdf|png|jpg|jpeg|mp4)$/i;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'video/mp4'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  const isExtAllowed = ALLOWED_EXTENSIONS.test(ext);
  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(mime);

  if (isExtAllowed && isMimeAllowed) {
    return cb(null, true);
  }

  const err = new Error('File type not allowed. Only PDF, PNG, JPG, and MP4 files are permitted.');
  err.code = 'INVALID_FILE_TYPE';
  return cb(err, false);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB maximum
  },
  fileFilter
});

module.exports = upload;
