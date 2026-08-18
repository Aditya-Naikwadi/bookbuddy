const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  getMyPreferences,
  updateMyPreferences,
} = require('../controllers/notificationPrefController');

router.use(protect);

router.route('/me').get(getMyPreferences).patch(updateMyPreferences);

module.exports = router;
