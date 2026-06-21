const asyncHandler = require('express-async-handler');

// @desc    Get College Admin Dashboard summary data
// @route   GET /api/dashboards/college-admin
// @access  Private/CollegeAdmin
const getCollegeAdminDashboardSummary = asyncHandler(async (req, res) => {
  // Placeholder for College Admin stats (e.g., their specific library stats, fines collected)
  res.json({
    success: true,
    data: {
      totalStudents: 1200,
      activeLoans: 350,
      overdueLoans: 45,
      finesCollected: 12500
    }
  });
});

module.exports = {
  getCollegeAdminDashboardSummary,
};
