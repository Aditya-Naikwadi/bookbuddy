const express = require('express');
const router = express.Router();
const { getMyRecommendations } = require('../controllers/recommendationController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/me').get(getMyRecommendations);

module.exports = router;
