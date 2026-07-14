const express = require('express');
const router = express.Router();
const { getMyNotifications, markAsRead } = require('../controllers/notificationController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');

router.use(protect);

router.route('/me').get(getMyNotifications);
router.route('/:id/read').patch(validate(paramIdSchema), markAsRead);

module.exports = router;
