// Controller handling authentication lifecycles (register, login, token refresh, and logout).
const User = require('../models/User');
const College = require('../models/College');
const AppError = require('../utils/AppError');
const { generateTokenPair, hashToken } = require('../utils/token');
const jwt = require('jsonwebtoken');
const config = require('../config');

// @desc    Register a new user (public student/admin signup)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { studentId, name, email, password, role, collegeId } = req.body;

    // Disallow public registration of super-admin accounts
    if (role === 'super-admin') {
      return next(new AppError('Public registration of super-admin accounts is forbidden.', 403));
    }

    // Verify College exists if collegeId is provided
    if (collegeId) {
      const college = await College.findById(collegeId);
      if (!college || !college.isActive) {
        return next(new AppError('The specified college is inactive or does not exist.', 400));
      }
    }

    // Check unique credentials
    const userExists = await User.findOne({ $or: [{ email }, { studentId }] });
    if (userExists) {
      return next(new AppError('User with this email or Student ID already exists.', 400));
    }

    // Create the User (password is hashed in pre-save middleware)
    const user = await User.create({
      studentId,
      name,
      email,
      password,
      role: role || 'student',
      collegeId: role === 'super-admin' ? undefined : collegeId,
    });

    // Generate tokens
    const { accessToken, refreshToken, hash } = generateTokenPair(user);

    // Save refresh token hash
    user.refreshTokenHash = hash;
    await user.save();

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
      refreshToken,
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

    // Query user and select the password field explicitly
    const user = await User.findOne({
      $or: [{ email: credential }, { studentId: credential }],
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

    // Generate tokens
    const { accessToken, refreshToken, hash } = generateTokenPair(user);

    // Save refresh token hash
    user.refreshTokenHash = hash;
    await user.save();

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
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: clientToken } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(clientToken, config.jwt.refreshSecret);
    } catch (_err) {
      return next(new AppError('Invalid or expired refresh token.', 401));
    }

    const clientHash = hashToken(clientToken);

    // Fetch user and explicitly select refreshTokenHash and isActive
    const user = await User.findById(decoded.userId).select('+refreshTokenHash +isActive');
    if (!user || !user.isActive) {
      return next(new AppError('User is deactivated or does not exist.', 401));
    }

    // Verify stored refresh token hash matches the client token's hash
    if (!user.refreshTokenHash || user.refreshTokenHash !== clientHash) {
      // Security measure: invalidate token hash on mismatch to mitigate replay attacks
      user.refreshTokenHash = undefined;
      await user.save();
      return next(new AppError('Refresh token mismatch. Revoking access.', 401));
    }

    // Rotate token pair
    const { accessToken, refreshToken: newRefreshToken, hash } = generateTokenPair(user);

    user.refreshTokenHash = hash;
    await user.save();

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user & invalidate refresh token
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshTokenHash = undefined;
      await user.save();
    }

    res.json({
      success: true,
      message: 'Logged out successfully.',
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
