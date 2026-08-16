const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');

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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `proof-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid document type. Only PDF, JPG, and PNG files are allowed.'), false);
  }
};

const uploadProof = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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
  studentRegisterSchema,
  verifyEmailSchema,
  tenantOnboardingSchema,
} = require('../validations/registration.validation');

const validate = require('../middlewares/validate');
const { authLimiter } = require('../middlewares/rateLimiters');

// Public route to get list of active colleges for Flow A dropdown
router.get('/colleges', getActiveColleges);

// Flow A: Student Self-Registration & OTP Verification
router.post('/student', authLimiter, validate(studentRegisterSchema), registerStudent);

router.post('/verify-email', authLimiter, validate(verifyEmailSchema), verifyStudentEmail);

// Flow B: Tenant Onboarding Submission
router.post(
  '/tenant-onboarding',
  authLimiter,
  uploadProof.single('proofDocument'),
  validate(tenantOnboardingSchema),
  submitTenantOnboarding
);

// Flow B: Domain ownership verification token link
router.get('/verify-domain', verifyAdminDomain);
router.post('/verify-domain-dns', authLimiter, verifyDomainDns);

// Flow B: Resubmit rejected application
router.put('/tenant-onboarding/:requestId/resubmit', authLimiter, resubmitTenantOnboarding);

module.exports = router;
