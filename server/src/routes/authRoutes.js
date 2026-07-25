const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getUserProfile,
  setupMfa,
  verifyMfa,
} = require('../controllers/authController');
const { googleAuthHandler } = require('../controllers/googleAuthController');
const { getCsrfTokenController } = require('../middlewares/csrf');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { registerSchema, loginSchema, refreshSchema } = require('../validations/auth.validation');
const { authLimiter } = require('../middlewares/rateLimiters');
const { loginRateLimiter } = require('../middlewares/loginRateLimiter');

// @desc    CSRF token generation endpoint
// @access  Public
router.get('/csrf-token', getCsrfTokenController);

// @desc    Register a student
// @access  Public
router.post('/register', authLimiter, validate(registerSchema), registerUser);

// @desc    Login user
// @access  Public
router.post('/login', loginRateLimiter, authLimiter, validate(loginSchema), loginUser);

// @desc    Google OAuth 2.0 Single Sign-On
// @access  Public
router.post('/google', authLimiter, googleAuthHandler);

// @desc    Refresh token rotation
// @access  Public
router.post('/refresh', authLimiter, validate(refreshSchema), refreshToken);

// @desc    Logout user
// @access  Public / Private
router.post('/logout', logoutUser);

// @desc    Get user profile
// @access  Private
router.get('/profile', protect, getUserProfile);

// @desc    MFA Setup & Verification
// @access  Private
router.post('/mfa/setup', protect, setupMfa);
router.post('/mfa/verify', protect, verifyMfa);

module.exports = router;
