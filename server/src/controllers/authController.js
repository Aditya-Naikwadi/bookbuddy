// Controller handling authentication lifecycles (register, login, token refresh, and logout).
const User = require('../models/User');
const College = require('../models/College');
const RefreshToken = require('../models/RefreshToken');
const AppError = require('../utils/AppError');
const { generateTokenPair, hashToken } = require('../utils/token');
const config = require('../config');

// Helper to set httpOnly refresh token cookie
const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
};

// @desc    Register a new user (public student/admin signup)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    let { studentId, name, email, password, role, collegeId } = req.body;

    if (role === 'super-admin' || role === 'college-admin') {
      return next(new AppError('Public registration of administrative roles is forbidden.', 403));
    }

    if (collegeId) {
      const college = await College.findById(collegeId);
      if (!college || !college.isActive) {
        return next(new AppError('The specified college is inactive or does not exist.', 400));
      }
    } else {
      const defaultCollege = await College.findOne({ isActive: true });
      if (defaultCollege) {
        collegeId = defaultCollege._id;
      }
    }

    const userExists = await User.findOne({ $or: [{ email }, { studentId }] });
    if (userExists) {
      return next(new AppError('User with this email or Student ID already exists.', 400));
    }

    const user = await User.create({
      studentId,
      name,
      email,
      password,
      role: role || 'student',
      collegeId: role === 'super-admin' ? undefined : collegeId,
    });

    const { accessToken, refreshToken, hash } = generateTokenPair(user);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, studentId, password } = req.body;
    const credential = email || studentId;
    const normalizedEmail = email
      ? email.trim().toLowerCase()
      : credential
        ? credential.trim().toLowerCase()
        : '';

    const user = await User.findOne({
      $or: [{ email: normalizedEmail }, { email: credential }, { studentId: credential }],
    }).select('+password');

    if (!user) {
      return next(new AppError('Invalid credentials.', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated.', 401));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('Invalid credentials.', 401));
    }

    const { accessToken, refreshToken, hash } = generateTokenPair(user);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    setRefreshTokenCookie(res, refreshToken);

    res.json({
      success: true,
      user: {
        _id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token & rotate refresh token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res, next) => {
  try {
    const clientToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!clientToken) {
      return next(new AppError('No refresh token provided.', 401));
    }

    const clientHash = hashToken(clientToken);

    const existingTokenDoc = await RefreshToken.findOne({ tokenHash: clientHash }).select(
      '+tokenHash'
    );

    if (!existingTokenDoc) {
      clearRefreshTokenCookie(res);
      return next(new AppError('Invalid or expired refresh token.', 401));
    }

    // THEFT DETECTION: If token doc was already revoked (reused revoked token)
    if (existingTokenDoc.revokedAt) {
      // Revoke ALL sessions for this user!
      await RefreshToken.updateMany({ userId: existingTokenDoc.userId }, { revokedAt: new Date() });

      clearRefreshTokenCookie(res);
      return next(
        new AppError('Security Warning: Session reuse detected. All sessions revoked.', 401)
      );
    }

    // Expiration check
    if (existingTokenDoc.expiresAt < new Date()) {
      existingTokenDoc.revokedAt = new Date();
      await existingTokenDoc.save();

      clearRefreshTokenCookie(res);
      return next(new AppError('Refresh token expired.', 401));
    }

    const user = await User.findById(existingTokenDoc.userId).select('+isActive');
    if (!user || !user.isActive) {
      clearRefreshTokenCookie(res);
      return next(new AppError('User is deactivated or does not exist.', 401));
    }

    // ROTATION: Revoke current token and record replacement
    const { accessToken, refreshToken: newRefreshToken, hash: newHash } = generateTokenPair(user);

    existingTokenDoc.revokedAt = new Date();
    existingTokenDoc.replacedBy = newHash;
    await existingTokenDoc.save();

    await RefreshToken.create({
      userId: user._id,
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      success: true,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user & invalidate refresh token
// @route   POST /api/auth/logout
// @access  Public / Private
const logoutUser = async (req, res, next) => {
  try {
    const clientToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const allDevices = req.body?.allDevices === true;

    if (allDevices && (req.user?._id || req.user?.id)) {
      const userId = req.user._id || req.user.id;
      await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
    } else if (clientToken) {
      const clientHash = hashToken(clientToken);
      await RefreshToken.updateOne({ tokenHash: clientHash }, { revokedAt: new Date() });
    } else if (req.user?._id || req.user?.id) {
      const userId = req.user._id || req.user.id;
      await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
    }

    clearRefreshTokenCookie(res);

    res.json({
      success: true,
      message: allDevices ? 'Logged out of all devices successfully.' : 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found.', 404));
    }
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getUserProfile,
};
