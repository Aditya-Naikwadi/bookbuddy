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
  changePassword,
} = require('../controllers/authController');
const { googleAuthHandler } = require('../controllers/googleAuthController');
const { handleOAuthCallback, getMe } = require('../controllers/oauthController');
const { getCsrfTokenController } = require('../middlewares/csrf');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  loginSchema,
  refreshSchema,
  registerRouteSchema,
} = require('@bookbuddy/shared/schemas/auth');
const { authLimiter } = require('../middlewares/rateLimiters');
const { loginRateLimiter } = require('../middlewares/loginRateLimiter');

const activationController = require('../controllers/activationController');

// @desc    CSRF token generation endpoint
// @access  Public
router.get('/csrf-token', getCsrfTokenController);

// @desc    Activation Token Verification & Account Setup
// @access  Public
router.get('/activate/verify', activationController.verifyActivationToken);
router.post('/activate/confirm', authLimiter, activationController.activateAccount);

// @desc    Register a user
// @access  Public
router.post('/register', authLimiter, validate(registerRouteSchema), registerUser);

// @desc    Login user
// @access  Public
router.post('/login', loginRateLimiter, authLimiter, validate(loginSchema), loginUser);

// @desc    Google OAuth 2.0 Single Sign-On (Post endpoint for ID token payload)
// @access  Public
router.post('/google', authLimiter, googleAuthHandler);

const { generateOAuthState, verifyOAuthState } = require('../utils/oauthStateHelper');

// Login redirect with signed state
const initiateGoogleOAuth = (req, res, next) => {
  const state = generateOAuthState({
    collegeId: req.query.collegeId,
    collegeSlug: req.query.collegeSlug,
    returnUrl: req.query.returnUrl,
    provider: 'google',
  });
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
    session: false,
  })(req, res, next);
};

const initiateGitHubOAuth = (req, res, next) => {
  const state = generateOAuthState({
    collegeId: req.query.collegeId,
    collegeSlug: req.query.collegeSlug,
    returnUrl: req.query.returnUrl,
    provider: 'github',
  });
  passport.authenticate('github', {
    scope: ['user:email'],
    state,
    session: false,
  })(req, res, next);
};

// Callback state verification middleware
const verifyOAuthStateMiddleware = (req, res, next) => {
  if (req.query.state) {
    const verified = verifyOAuthState(req.query.state);
    if (!verified.valid) {
      const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
      if (acceptsHtml) {
        return res.redirect('/login?error=invalid_oauth_state');
      }
      return res.status(400).json({
        success: false,
        message: verified.error || 'Invalid or expired OAuth state parameter',
      });
    }
    req.verifiedOAuthState = verified.payload;
  }
  next();
};

// @desc    Passport Google OAuth 2.0 Login Redirect
// @access  Public
router.get('/google', initiateGoogleOAuth);

// @desc    Passport Google OAuth 2.0 Callback
// @access  Public
router.get(
  '/google/callback',
  verifyOAuthStateMiddleware,
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  handleOAuthCallback
);

// @desc    Passport GitHub OAuth Login Redirect
// @access  Public
router.get('/github', initiateGitHubOAuth);

// @desc    Passport GitHub OAuth Callback
// @access  Public
router.get(
  '/github/callback',
  verifyOAuthStateMiddleware,
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
router.post('/mfa/setup', protect, authLimiter, setupMfa);
router.post('/mfa/verify', protect, authLimiter, verifyMfa);

// @desc    Change password (first-login forced change or user update)
// @access  Private
router.post('/change-password', protect, authLimiter, changePassword);

module.exports = router;
