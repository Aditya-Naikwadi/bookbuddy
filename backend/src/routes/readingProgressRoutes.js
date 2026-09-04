const express = require('express');
const router = express.Router();
const { getReadingProgress, updateReadingProgress } = require('../controllers/progressController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/:resourceId').get(getReadingProgress).put(updateReadingProgress);

module.exports = router;
