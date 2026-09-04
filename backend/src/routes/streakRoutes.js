const express = require('express');
const router = express.Router();
const {
  getMyStreak,
  checkIn,
  repairStreak,
  getStickerCatalog,
  getMyStickers,
  getRewardsLadder,
  getStreakHistory,
  getBadges,
  createBadge,
  recalculateMyStreak,
} = require('../controllers/streakController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/me').get(getMyStreak);
router.route('/check-in').post(checkIn);
router.route('/checkin').post(checkIn); // Alias
router.route('/history').get(getStreakHistory);
router.route('/badges').get(getBadges).post(createBadge);
router.route('/recalculate').post(recalculateMyStreak);
router.route('/rewards').get(getRewardsLadder);
router.route('/repair').post(repairStreak);
router.route('/stickers').get(getMyStickers);
router.route('/stickers/catalog').get(getStickerCatalog);

module.exports = router;
