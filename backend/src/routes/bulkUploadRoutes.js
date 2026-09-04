const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, requireRole } = require('../middlewares/auth');
const {
  submitBulkUpload,
  getBulkUploadStatus,
  downloadUploadErrorReport,
} = require('../controllers/bulkUploadController');

// Bulk upload endpoints
router.post(
  '/students/bulk-upload',
  protect,
  requireRole('college-admin', 'super-admin', 'super_admin'),
  submitBulkUpload
);

router.get(
  '/students/upload/:jobId',
  protect,
  requireRole('college-admin', 'super-admin', 'super_admin'),
  getBulkUploadStatus
);

router.get(
  '/students/upload/:jobId/errors',
  protect,
  requireRole('college-admin', 'super-admin', 'super_admin'),
  downloadUploadErrorReport
);

module.exports = router;
