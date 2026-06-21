const asyncHandler = require('express-async-handler');

// @desc    Get General Dashboard summary data
// @route   GET /api/dashboards/general
// @access  Public or Base User
const getGeneralDashboardSummary = asyncHandler(async (req, res) => {
  // Placeholder for General public stats (e.g., total books in catalog, announcements)
  res.json({
    success: true,
    data: {
      totalCatalogBooks: 15000,
      newArrivals: 120,
      libraryHours: '8:00 AM - 10:00 PM',
      announcements: 'Library will be closed on Friday for maintenance.'
    }
  });
});

module.exports = {
  getGeneralDashboardSummary,
};
