// Authentication routes mapping.
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getUserProfile,
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { registerSchema, loginSchema, refreshSchema } = require('../validations/auth.validation');
const rateLimit = require('express-rate-limit');

const loginRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many auth attempts. Please try again after 15 minutes.',
    code: 429,
  },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many token refresh attempts. Please try again after 15 minutes.',
    code: 429,
  },
});

// @desc    Register a student
// @roles   public signup
// @scoping global
router.post('/register', loginRegisterLimiter, validate(registerSchema), registerUser);

// @desc    Login user
// @roles   public signup
// @scoping global
router.post('/login', loginRegisterLimiter, validate(loginSchema), loginUser);

// @desc    Refresh token rotation
// @roles   public token access
// @scoping global
router.post('/refresh', refreshLimiter, validate(refreshSchema), refreshToken);

// @desc    Logout user
// @roles   student, college-admin, super-admin, general
// @scoping global (token revocation)
router.post('/logout', protect, logoutUser);

// @desc    Get user profile
// @roles   student, college-admin, super-admin, general
// @scoping global
router.get('/profile', protect, getUserProfile);

module.exports = router;
