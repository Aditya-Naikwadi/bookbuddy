const express = require('express');
const multer = require('multer');
const rosterUploadController = require('../controllers/rosterUploadController');
const { protect, restrictTo } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');

const router = express.Router();

// Multer in-memory storage for CSV/Excel validation & parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv',
      'text/plain',
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, XLSX, or XLS files are allowed'));
    }
  },
});

// Protect all admin student roster endpoints
router.use(protect);
router.use(restrictTo('college-admin', 'super-admin'));
router.use(scopeToTenant);

// Upload routes
router.post('/upload/validate', upload.single('file'), rosterUploadController.validateRosterUpload);

router.post('/upload/commit', rosterUploadController.commitRosterUpload);

router.get('/export', rosterUploadController.exportRoster);

module.exports = router;
