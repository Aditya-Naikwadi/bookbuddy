const asyncHandler = require('../utils/asyncHandler');
const UserRecommendation = require('../models/UserRecommendation');

// @desc    Get personalized book recommendations for the requesting user (Cache read only)
// @route   GET /api/v1/recommendations OR GET /api/recommendations
// @access  Private
const getRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;

  // STRICT CACHE READ ONLY: Fast direct query from UserRecommendation document
  // No live pipeline execution or heavy aggregation on the request path
  const userRecDoc = await UserRecommendation.findOne({ userId }).populate(
    'recommendations.bookId',
    'title author category isbn avgRating coverImage ratingCount tags'
  );

  const recommendations = userRecDoc ? userRecDoc.recommendations : [];

  res.json({
    success: true,
    count: recommendations.length,
    data: recommendations,
    computedAt: userRecDoc ? userRecDoc.computedAt : null,
  });
});

module.exports = {
  getRecommendations,
};
