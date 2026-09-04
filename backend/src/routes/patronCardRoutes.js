const express = require('express');
const router = express.Router();
const {
  getMyPatronCard,
  getRotatingToken,
  verifyPatronCardToken,
} = require('../controllers/patronCardController');
const { protect } = require('../middlewares/auth');

router.post('/verify', verifyPatronCardToken); // Public / Scanner verification

router.use(protect);

router.route('/me').get(getMyPatronCard);
router.route('/token').get(getRotatingToken);

module.exports = router;
