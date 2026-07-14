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
const { authLimiter } = require('../middlewares/rateLimiters');

// @desc    Register a student
// @roles   public signup
// @scoping global
router.post('/register', authLimiter, validate(registerSchema), registerUser);

// @desc    Login user
// @roles   public signup
// @scoping global
router.post('/login', authLimiter, validate(loginSchema), loginUser);

// @desc    Refresh token rotation
// @roles   public token access
// @scoping global
router.post('/refresh', authLimiter, validate(refreshSchema), refreshToken);

// @desc    Logout user
// @roles   student, college-admin, super-admin, general
// @scoping global (token revocation)
router.post('/logout', protect, logoutUser);

// @desc    Get user profile
// @roles   student, college-admin, super-admin, general
// @scoping global
router.get('/profile', protect, getUserProfile);

module.exports = router;
