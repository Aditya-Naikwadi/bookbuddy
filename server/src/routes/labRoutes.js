const express = require('express');
const router = express.Router();
const {
  getSeats,
  createBooking,
  getMyBookings,
  cancelBooking,
  getAvailability,
} = require('../controllers/labController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');
const {
  createBookingSchema,
  getAvailabilitySchema,
} = require('../validations/facilities.validation');

router.use(protect);

router.route('/seats').get(getSeats);
router.route('/availability').get(validate(getAvailabilitySchema), getAvailability);
router.route('/bookings').post(validate(createBookingSchema), createBooking);
router.route('/bookings/me').get(getMyBookings);
router.route('/bookings/:id').delete(validate(paramIdSchema), cancelBooking);

module.exports = router;
