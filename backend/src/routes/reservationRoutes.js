const express = require('express');
const router = express.Router();
const {
  joinQueueHandler,
  getMyReservations,
  leaveQueueHandler,
} = require('../controllers/reservationController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');
const { placeHoldSchema } = require('../validations/library.validation');

router.use(protect);

router.route('/').post(validate(placeHoldSchema), joinQueueHandler);

router.route('/me').get(getMyReservations);

router.route('/:id').delete(validate(paramIdSchema), leaveQueueHandler);

module.exports = router;
