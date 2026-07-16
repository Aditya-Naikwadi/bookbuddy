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

// Multer upload config
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp'),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB Max File Size limit
  },
});

router.use(protect);
router.use(scopeToTenant);

// Ebook Upload (Admin/Staff only check could be added, but we allow authenticated dashboard users)
router.post('/upload', upload.single('file'), uploadEbook);

// Ebook streaming (with range requests support and rate limits)
router.get('/:resourceId/content', expensiveRouteLimiter, streamEbookContent);

// Ebook reading position bookmarks
router.get('/:resourceId/position', getReadingPosition);
router.put('/:resourceId/position', setReadingPosition);

module.exports = router;
