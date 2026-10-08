const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  uploadEbook,
  streamEbookContent,
  getReadingPosition,
  setReadingPosition,
} = require('../controllers/readerController');
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const { expensiveRouteLimiter } = require('../middlewares/rateLimiters');

const { createSafeFileFilter, validateMagicBytes } = require('../middlewares/fileUploadValidation');

// Multer upload config
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp'),
  fileFilter: createSafeFileFilter({
    allowedExts: ['.epub'],
    allowedMimes: ['application/epub+zip', 'application/zip'],
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB Max File Size limit
    files: 1,
  },
});

router.use(protect);
router.use(scopeToTenant);

// Ebook Upload (Authenticated dashboard users, strictly rate-limited and validated)
router.post(
  '/upload',
  expensiveRouteLimiter,
  upload.single('file'),
  validateMagicBytes(['application/epub+zip']),
  uploadEbook
);

// Ebook streaming (with range requests support and rate limits)
router.get('/:resourceId/content', expensiveRouteLimiter, streamEbookContent);

// Ebook reading position bookmarks
router.get('/:resourceId/position', getReadingPosition);
router.put('/:resourceId/position', setReadingPosition);

module.exports = router;
