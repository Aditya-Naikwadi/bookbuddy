const express = require('express');
const router = express.Router();
const {
  getSeats,
  createBooking,
  getMyBookings,
  cancelBooking,
  getAvailability,
  checkInBooking,
  joinQueue,
  leaveQueue,
  getMyQueue,
  claimQueueSpot,
} = require('../controllers/labController');
const { protect } = require('../middlewares/auth');
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');
const {
  createBookingSchema,
  getAvailabilitySchema,
} = require('../validations/facilities.validation');

const { expensiveRouteLimiter } = require('../middlewares/rateLimiters');

router.use(protect);
router.use(requireFeature('facilities_booking'));

router.route('/seats').get(getSeats);
router
  .route('/availability')
  .get(expensiveRouteLimiter, validate(getAvailabilitySchema), getAvailability);
router.route('/bookings').post(validate(createBookingSchema), createBooking);
router.route('/bookings/me').get(getMyBookings);
router.route('/bookings/:id').delete(validate(paramIdSchema), cancelBooking);
router.route('/bookings/:id/check-in').post(validate(paramIdSchema), checkInBooking);

// Queue endpoints (§10.4 & §11)
router.route('/queue/join').post(joinQueue);
router.route('/queue/me').get(getMyQueue);
router.route('/queue/:id').delete(validate(paramIdSchema), leaveQueue);
router.route('/queue/:id/claim').post(validate(paramIdSchema), claimQueueSpot);

module.exports = router;
