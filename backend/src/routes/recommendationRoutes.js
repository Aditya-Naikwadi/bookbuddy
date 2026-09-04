const express = require('express');
const router = express.Router();
const { getRecommendations } = require('../controllers/recommendationController');
const { protect } = require('../middlewares/auth');

// @desc    Get user recommendations (Cache read only)
// @route   GET /api/v1/recommendations OR GET /api/recommendations
// @access  Private
router.get('/', protect, getRecommendations);

module.exports = router;
