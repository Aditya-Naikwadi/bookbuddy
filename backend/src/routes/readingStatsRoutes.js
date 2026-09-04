const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { getMyReadingStats } = require('../controllers/readingStatsController');

router.use(protect);

router.get('/me', getMyReadingStats);

module.exports = router;
