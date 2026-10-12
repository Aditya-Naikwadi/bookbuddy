const express = require('express');
const router = express.Router();
const { getReadingProgress, updateReadingProgress } = require('../controllers/progressController');
const { protect } = require('../middlewares/auth');
const noCache = require('../middlewares/noCache');

router.use(protect);
router.use(noCache);

router.route('/:resourceId').get(getReadingProgress).put(updateReadingProgress);

module.exports = router;
