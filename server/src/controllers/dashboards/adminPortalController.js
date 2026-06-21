const asyncHandler = require('express-async-handler');

// @desc    Get Admin Portal Dashboard summary data
// @route   GET /api/dashboards/admin-portal
// @access  Private/Admin
const getAdminDashboardSummary = asyncHandler(async (req, res) => {
  // Placeholder for Global Admin stats (e.g., total users across all colleges, system health)
  res.json({
    success: true,
    data: {
      totalColleges: 15,
      totalUsers: 5000,
      activeSubscriptions: 12,
      systemStatus: 'Healthy'
    }
  });
});

module.exports = {
  getAdminDashboardSummary,
};
