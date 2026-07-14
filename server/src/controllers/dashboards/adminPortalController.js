const College = require('../../models/College');
const User = require('../../models/User');
const Loan = require('../../models/Loan');
const Fine = require('../../models/Fine');
const AuditLog = require('../../models/AuditLog');
const AppError = require('../../utils/AppError');

// @desc    Get global overview stats
// @route   GET /api/dashboards/admin-portal/overview
// @access  Private/SuperAdmin
const getOverview = async (req, res, next) => {
  try {
    const totalColleges = await College.countDocuments();
    const activeLoans = await Loan.countDocuments({ status: 'active' });
    const unpaidFinesCount = await Fine.countDocuments({ status: 'unpaid' });

    // Aggregate user counts by role
    const userRoleCounts = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    // Format role counts into key-value map
    const rolesMap = {
      student: 0,
      'college-admin': 0,
      'super-admin': 0,
      librarian: 0,
      admin: 0,
    };
    userRoleCounts.forEach((roleGroup) => {
      if (roleGroup._id) {
        rolesMap[roleGroup._id] = roleGroup.count;
      }
    });

    // Aggregate total unpaid fine amount
    const unpaidFineSum = await Fine.aggregate([
      { $match: { status: 'unpaid' } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);
    const totalUnpaidFineAmount = unpaidFineSum.length > 0 ? unpaidFineSum[0].totalAmount : 0;

    res.json({
      success: true,
      data: {
        totalColleges,
        activeLoans,
        unpaidFinesCount,
        totalUnpaidFineAmount,
        userCountsByRole: rolesMap,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List all college-admins across all colleges
// @route   GET /api/dashboards/admin-portal/admins
// @access  Private/SuperAdmin
const getAdmins = async (req, res, next) => {
  try {
    const { collegeId } = req.query;
    const filter = { role: 'college-admin' };
    if (collegeId) {
      filter.collegeId = collegeId;
    }

    const admins = await User.find(filter)
      .populate('collegeId', 'name code')
      .select('-password -refreshTokenHash');

    res.json({ success: true, data: admins });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new college-admin
// @route   POST /api/dashboards/admin-portal/admins
// @access  Private/SuperAdmin
const createAdmin = async (req, res, next) => {
  try {
    const { studentId, name, email, password, collegeId } = req.body;

    // Verify college exists
    const college = await College.findById(collegeId);
    if (!college) {
      return next(new AppError('Target college does not exist.', 404));
    }

    // Create admin user
    const admin = await User.create({
      studentId,
      name,
      email,
      password,
      role: 'college-admin',
      collegeId,
    });

    // Prepare audit meta (exclude password)
    res.locals.auditMeta = {
      targetType: 'User',
      targetId: admin._id,
      collegeId,
      metadata: { studentId, name, email },
    };

    // Strip password from returned response
    const responseData = admin.toObject();
    delete responseData.password;

    res.status(201).json({
      success: true,
      data: responseData,
      message: 'College admin created successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new College
// @route   POST /api/dashboards/admin-portal/colleges
// @access  Private/SuperAdmin
const createCollege = async (req, res, next) => {
  try {
    const { name, code } = req.body;

    const college = await College.create({ name, code });

    res.locals.auditMeta = {
      targetType: 'College',
      targetId: college._id,
      collegeId: college._id,
      metadata: { name, code },
    };

    res.status(201).json({
      success: true,
      data: college,
      message: 'College registered successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get audit logs
// @route   GET /api/dashboards/admin-portal/audit-logs
// @access  Private/SuperAdmin
const getAuditLogs = async (req, res, next) => {
  try {
    const { actorId, action, collegeId, startDate, endDate, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (actorId) filter.actorId = actorId;
    if (action) filter.action = action;
    if (collegeId) filter.collegeId = collegeId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .populate('actorId', 'name email studentId')
      .populate('collegeId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getAdmins,
  createAdmin,
  createCollege,
  getAuditLogs,
};
