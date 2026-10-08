const express = require('express');
const multer = require('multer');
const rosterUploadController = require('../controllers/rosterUploadController');
const { protect, restrictTo } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');

const router = express.Router();

const { createSafeFileFilter, validateMagicBytes } = require('../middlewares/fileUploadValidation');
const { expensiveRouteLimiter } = require('../middlewares/rateLimiters');

// Multer in-memory storage for CSV/Excel validation & parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    files: 1,
  },
  fileFilter: createSafeFileFilter({
    allowedExts: ['.csv', '.xlsx', '.xls'],
    allowedMimes: [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv',
      'text/plain',
    ],
  }),
});

// Protect all admin student roster endpoints
router.use(protect);
router.use(restrictTo('college-admin', 'super-admin'));
router.use(scopeToTenant);

// Upload & Validation routes
router.post(
  '/upload/validate',
  expensiveRouteLimiter,
  upload.single('file'),
  validateMagicBytes([
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]),
  rosterUploadController.validateRosterUpload
);
router.post('/upload/commit', rosterUploadController.commitRosterUpload);
router.get('/upload/:batchId/status', rosterUploadController.getBatchStatus);
router.get('/upload/:batchId/delivery-status', rosterUploadController.getBatchDeliveryStatus);
router.get('/upload/:batchId/handouts', rosterUploadController.downloadBatchHandouts);

// Export active college roster
router.get('/export', rosterUploadController.exportRoster);

module.exports = router;
