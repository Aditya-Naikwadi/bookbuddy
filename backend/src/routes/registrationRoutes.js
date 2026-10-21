const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');

const {
  createSafeFileFilter,
  generateSafeFilename,
  validateMagicBytes,
} = require('../middlewares/fileUploadValidation');

// Configure Multer for verification document uploads (Flow B)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require('fs');
    const uploadDir = path.join(__dirname, '../../uploads/proofs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    try {
      const safeFilename = generateSafeFilename(file.originalname, 'proof');
      cb(null, safeFilename);
    } catch (err) {
      cb(err);
    }
  },
});

const uploadProof = multer({
  storage,
  fileFilter: createSafeFileFilter({
    allowedExts: ['.pdf', '.jpg', '.jpeg', '.png'],
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/png'],
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10MB limit, 1 file
});

const {
  getActiveColleges,
  registerStudent,
  verifyStudentEmail,
  submitTenantOnboarding,
  verifyAdminDomain,
  resubmitTenantOnboarding,
  verifyDomainDns,
} = require('../controllers/registrationController');

const {
  tenantOnboardingSchema,
  studentRegisterRouteSchema,
  verifyEmailRouteSchema,
} = require('@bookbuddy/shared/schemas/auth');

const validate = require('../middlewares/validate');
const { authLimiter, searchLimiter } = require('../middlewares/rateLimiters');

// Public route to get list of active colleges for Flow A dropdown
router.get('/colleges', searchLimiter, getActiveColleges);

// Flow A: Student Self-Registration & OTP Verification
router.post('/student', authLimiter, validate(studentRegisterRouteSchema), registerStudent);

router.post('/verify-email', authLimiter, validate(verifyEmailRouteSchema), verifyStudentEmail);

// Flow B: Tenant Onboarding Submission
router.post(
  '/tenant-onboarding',
  authLimiter,
  uploadProof.single('proofDocument'),
  validateMagicBytes(['application/pdf', 'image/jpeg', 'image/png']),
  validate(tenantOnboardingSchema),
  submitTenantOnboarding
);

// Flow B: Domain ownership verification token link
router.get('/verify-domain', authLimiter, verifyAdminDomain);
router.post('/verify-domain-dns', authLimiter, verifyDomainDns);

// Flow B: Resubmit rejected application
router.put('/tenant-onboarding/:requestId/resubmit', authLimiter, resubmitTenantOnboarding);

module.exports = router;
