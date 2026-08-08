const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
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
const { handleOAuthCallback, getMe } = require('../controllers/oauthController');
const { getCsrfTokenController } = require('../middlewares/csrf');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { registerSchema, loginSchema, refreshSchema } = require('../validations/auth.validation');
const { authLimiter } = require('../middlewares/rateLimiters');
const { loginRateLimiter } = require('../middlewares/loginRateLimiter');

// @desc    CSRF token generation endpoint
// @access  Public
router.get('/csrf-token', getCsrfTokenController);

// @desc    Register a user
// @access  Public
router.post('/register', authLimiter, validate(registerSchema), registerUser);

// @desc    Login user
// @access  Public
router.post('/login', loginRateLimiter, authLimiter, validate(loginSchema), loginUser);

// @desc    Google OAuth 2.0 Single Sign-On (Post endpoint for ID token payload)
// @access  Public
router.post('/google', authLimiter, googleAuthHandler);

// @desc    Passport Google OAuth 2.0 Login Redirect
// @access  Public
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// @desc    Passport Google OAuth 2.0 Callback
// @access  Public
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  handleOAuthCallback
);

// @desc    Passport GitHub OAuth Login Redirect
// @access  Public
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));

// @desc    Passport GitHub OAuth Callback
// @access  Public
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login' }),
  handleOAuthCallback
);

// @desc    Get current authenticated user profile
// @access  Private
router.get('/me', protect, getMe);
router.get('/profile', protect, getUserProfile);

// @desc    Refresh token rotation
// @access  Public
router.post('/refresh', authLimiter, validate(refreshSchema), refreshToken);

// @desc    Logout user
// @access  Public / Private
router.post('/logout', logoutUser);
router.get('/logout', logoutUser);

// @desc    MFA Setup & Verification
// @access  Private
router.post('/mfa/setup', protect, setupMfa);
router.post('/mfa/verify', protect, verifyMfa);

module.exports = router;
