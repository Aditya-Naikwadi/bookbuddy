const sessionService = require('../services/sessionService');
const { getAuthCookieOptions } = require('../utils/cookieOptions');
const config = require('../config');
const AppError = require('../utils/AppError');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const setRefreshTokenCookie = (res, token, req = null) => {
  const opts = getAuthCookieOptions(req, {
    httpOnly: true,
    path: '/',
    maxAge: THIRTY_DAYS_MS,
  });
  res.cookie('refreshToken', token, opts);
};

/**
 * Handle Passport OAuth Callback (Google & GitHub)
 * Issues stateless JWT access token & session refresh token
 */
const handleOAuthCallback = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError('OAuth authentication failed. User object missing.', 401));
    }

    const user = req.user;
    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated.', 403));
    }

    const deviceInfo = req.headers['user-agent'] || 'OAuth Authenticated Client';
    const { accessToken, refreshToken } = await sessionService.createSession({
      user,
      deviceInfo,
    });

    setRefreshTokenCookie(res, refreshToken, req);

    // If request comes from a standard browser redirect flow, redirect to client with token
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (acceptsHtml && config.clientOrigin && config.clientOrigin !== '*') {
      const redirectUrl = `${config.clientOrigin}/oauth-success?token=${encodeURIComponent(
        accessToken
      )}`;
      return res.redirect(redirectUrl);
    }

    // Default API JSON response
    return res.status(200).json({
      success: true,
      message: 'OAuth authentication successful',
      user: {
        _id: user._id,
        id: user._id.toString(),
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        authProvider: user.authProvider,
        collegeId: user.collegeId,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/me
 * Return current authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return next(new AppError('User not found.', 404));
    }

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        id: user._id.toString(),
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        authProvider: user.authProvider,
        collegeId: user.collegeId,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleOAuthCallback,
  getMe,
};
