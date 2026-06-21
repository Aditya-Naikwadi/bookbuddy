const asyncHandler = require('express-async-handler');
const User = require('../../models/User');
const Book = require('../../models/Book');
const Loan = require('../../models/Loan');
const bcrypt = require('bcryptjs');

// @desc    Get Admin Portal Dashboard summary data
// @route   GET /api/dashboards/admin-portal/overview
// @access  Private/SuperAdmin
const getSystemOverview = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalStudents = await User.countDocuments({ role: 'student' });
  const totalAdmins = await User.countDocuments({ role: { $in: ['admin', 'super_admin'] } });
  const totalBooks = await Book.countDocuments();
  const activeLoans = await Loan.countDocuments({ status: 'active' });

  res.json({
    success: true,
    data: {
      totalUsers,
      totalStudents,
      totalAdmins,
      totalBooks,
      activeLoans,
      systemStatus: 'Healthy',
      timestamp: Date.now()
    }
  });
});

// @desc    Create a new College Admin
// @route   POST /api/dashboards/admin-portal/admins
// @access  Private/SuperAdmin
const createCollegeAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const adminUser = await User.create({
    name,
    email,
    password: hashedPassword,
    role: 'admin' // In our context, 'admin' is college admin, 'super_admin' might be the portal owner
  });

  res.status(201).json({ success: true, data: adminUser });
});

// @desc    Get all College Admins
// @route   GET /api/dashboards/admin-portal/admins
// @access  Private/SuperAdmin
const getCollegeAdmins = asyncHandler(async (req, res) => {
  const admins = await User.find({ role: 'admin' }).select('-password');
  res.json({ success: true, data: admins });
});

// @desc    Get System Audit Logs (Mocked for now)
// @route   GET /api/dashboards/admin-portal/audit-logs
// @access  Private/SuperAdmin
const getSystemAuditLogs = asyncHandler(async (req, res) => {
  // In a real system, you'd fetch from an AuditLog collection
  res.json({
    success: true,
    data: [
      { id: 1, action: 'CREATE_USER', user: 'SuperAdmin', target: 'John Doe', timestamp: new Date(Date.now() - 3600000) },
      { id: 2, action: 'SYSTEM_BACKUP', user: 'System', target: 'Database', timestamp: new Date(Date.now() - 7200000) }
    ]
  });
});

module.exports = {
  getSystemOverview,
  createCollegeAdmin,
  getCollegeAdmins,
  getSystemAuditLogs
};
