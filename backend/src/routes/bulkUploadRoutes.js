const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, requireRole } = require('../middlewares/auth');
const {
  submitBulkUpload,
  getBulkUploadStatus,
  downloadUploadErrorReport,
  downloadPrintedHandouts,
  getUploadAuditLogs,
  getUploadAuditLogByVersion,
  downloadAuditLogHandouts,
} = require('../controllers/bulkUploadController');

const allowedRoles = ['college-admin', 'super-admin', 'super_admin'];

// Bulk upload endpoints
router.post('/students/bulk-upload', protect, requireRole(...allowedRoles), submitBulkUpload);

router.get('/students/upload/:jobId', protect, requireRole(...allowedRoles), getBulkUploadStatus);

router.get(
  '/students/upload/:jobId/errors',
  protect,
  requireRole(...allowedRoles),
  downloadUploadErrorReport
);

router.get(
  '/students/upload/:jobId/handouts',
  protect,
  requireRole(...allowedRoles),
  downloadPrintedHandouts
);

// Versioned Upload Audit Log endpoints
router.get(
  '/students/upload-audit-logs',
  protect,
  requireRole(...allowedRoles),
  getUploadAuditLogs
);

router.get(
  '/students/upload-audit-logs/:version',
  protect,
  requireRole(...allowedRoles),
  getUploadAuditLogByVersion
);

router.get(
  '/students/upload-audit-logs/:version/handouts',
  protect,
  requireRole(...allowedRoles),
  downloadAuditLogHandouts
);

module.exports = router;
