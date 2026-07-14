const express = require('express');
const router = express.Router();
const {
  getMyStreak,
  repairStreak,
  getStickerCatalog,
  getMyStickers,
  getRewardsLadder,
} = require('../controllers/streakController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/me').get(getMyStreak);
router.route('/repair').post(repairStreak);
router.route('/rewards').get(getRewardsLadder);

module.exports = router;
