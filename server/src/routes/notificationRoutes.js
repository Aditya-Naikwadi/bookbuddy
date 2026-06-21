const express = require('express');
const router = express.Router();
const { getMyNotifications, markAsRead } = require('../controllers/notificationController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/me').get(getMyNotifications);
router.route('/:id/read').patch(markAsRead);

module.exports = router;
