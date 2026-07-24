const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const College = require('../models/College');
const RefreshToken = require('../models/RefreshToken');
const AppError = require('../utils/AppError');
const { generateTokenPair } = require('../utils/token');
const config = require('../config');
const crypto = require('crypto');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

/**
 * @desc    Authenticate or Register via Google OAuth 2.0 ID Token
 * @route   POST /api/v1/auth/google
 * @access  Public
 */
const googleAuthHandler = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return next(new AppError('Google ID Token is required.', 400));
    }

    let payload;

    // Verify token with Google Library or mock verification in test
    if (process.env.GOOGLE_CLIENT_ID && process.env.NODE_ENV !== 'test') {
      try {
        const ticket = await client.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (err) {
        return next(new AppError(`Google token verification failed: ${err.message}`, 401));
      }
    } else {
      // Decode or fallback payload for development/testing
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        }
      } catch {
        // Fallback dummy payload
      }
      if (!payload || !payload.email) {
        payload = {
          sub: `google_user_${Date.now()}`,
          email: req.body.email || `google_user_${Date.now()}@gmail.com`,
          name: req.body.name || 'Google Student User',
          picture: req.body.picture || '',
        };
      }
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return next(new AppError('Email not provided in Google ID Token.', 400));
    }

    const normalizedEmail = email.toLowerCase();
    let user = await User.findOne({
      $or: [{ googleId }, { email: normalizedEmail }],
    });

    if (user) {
      // Link Google account if not linked
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
      user.isEmailVerified = true;
      await user.save();
    } else {
      // Find active default college for new SSO student
      let defaultCollege = await College.findOne({ isActive: true });
      if (!defaultCollege) {
        defaultCollege = await College.create({
          name: 'Main Campus',
          code: 'MAIN',
          isActive: true,
        });
      }

      const generatedStudentId = `G-${crypto.randomInt(100000, 999999)}`;

      user = await User.create({
        googleId,
        authProvider: 'google',
        studentId: generatedStudentId,
        name: name || 'Google User',
        email: normalizedEmail,
        avatar: picture || '',
        collegeId: defaultCollege._id,
        role: 'student',
        isEmailVerified: true,
        membershipStatus: 'active',
        status: 'active',
      });
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact your librarian.', 403));
    }

    const { accessToken, refreshToken, hash } = generateTokenPair(user);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
        avatar: user.avatar,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  googleAuthHandler,
};
