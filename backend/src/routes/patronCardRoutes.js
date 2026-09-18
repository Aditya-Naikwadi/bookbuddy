const express = require('express');
const router = express.Router();
const {
  getMyPatronCard,
  getRotatingToken,
  verifyPatronCardToken,
} = require('../controllers/patronCardController');
const { protect } = require('../middlewares/auth');

const requireScannerOrStaffAuth = require('../middlewares/scannerOrStaffAuth');
const { patronCardVerifyLimiter } = require('../middlewares/rateLimiters');

router.post('/verify', patronCardVerifyLimiter, requireScannerOrStaffAuth, verifyPatronCardToken); // Scanner / Staff Gate verification

router.use(protect);

router.route('/me').get(getMyPatronCard);
router.route('/token').get(getRotatingToken);

module.exports = router;
