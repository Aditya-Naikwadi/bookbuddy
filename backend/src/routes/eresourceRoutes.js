const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  createSafeFileFilter,
  generateSafeFilename,
  validateMagicBytes,
} = require('../middlewares/fileUploadValidation');
const { expensiveRouteLimiter } = require('../middlewares/rateLimiters');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/ebooks');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    try {
      const safeFilename = generateSafeFilename(file.originalname, 'resource');
      cb(null, safeFilename);
    } catch (err) {
      cb(err);
    }
  },
});

const upload = multer({
  storage,
  fileFilter: createSafeFileFilter({
    allowedExts: ['.pdf', '.epub'],
    allowedMimes: ['application/pdf', 'application/epub+zip', 'application/zip'],
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1,
  },
});

const {
  listInternalResources,
  submitEResource,
  getMySubmissions,
  updateProgress,
  issueOfflineToken,
  getSignedDownloadUrl,
} = require('../controllers/eresourceController');

const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const validate = require('../middlewares/validate');
const { updateProgressSchema } = require('@bookbuddy/shared/schemas/personalization');

router.use(protect);
router.use(scopeToTenant);

router.get('/my-submissions', getMySubmissions);
router.post(
  '/submit',
  expensiveRouteLimiter,
  upload.single('file'),
  validateMagicBytes(['application/pdf', 'application/epub+zip']),
  submitEResource
);
router.get('/:id/download-url', getSignedDownloadUrl);
router.post('/:id/offline-token', issueOfflineToken);

router.route('/').get(listInternalResources);
router.route('/:eresourceId/progress').post(validate(updateProgressSchema), updateProgress);

module.exports = router;
