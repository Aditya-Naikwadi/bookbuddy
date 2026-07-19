const express = require('express');
const router = express.Router();
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  removeDeviceToken,
  getNotificationHistory,
} = require('../controllers/notificationController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');

router.use(protect);

router.route('/me').get(getMyNotifications);
router.route('/history').get(getNotificationHistory);
router.route('/read-all').patch(markAllAsRead);

router.route('/device-token').post(registerDeviceToken).delete(removeDeviceToken);

router.route('/:id/read').patch(validate(paramIdSchema), markAsRead);

module.exports = router;
