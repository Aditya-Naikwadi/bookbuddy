const express = require('express');
const router = express.Router();
const {
  getStickerCatalog,
  getMyStickers
} = require('../controllers/streakController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/').get(getStickerCatalog);
router.route('/me').get(getMyStickers);

module.exports = router;
