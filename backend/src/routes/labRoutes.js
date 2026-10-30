const express = require('express');
const router = express.Router();
const {
  getSeats,
  createBooking,
  getMyBookings,
  cancelBooking,
  getAvailability,
  checkInBooking,
  checkOutBooking,
  getMyUsage,
  getAdminUsage,
  exportAdminUsageCsv,
  joinQueue,
  leaveQueue,
  getMyQueue,
  claimQueueSpot,
} = require('../controllers/labController');
const { protect, requireRole } = require('../middlewares/auth');
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('@bookbuddy/shared/schemas/common');
const {
  createBookingRouteSchema,
  getLabAvailabilityRouteSchema,
} = require('@bookbuddy/shared/schemas/facilities');

const { expensiveRouteLimiter } = require('../middlewares/rateLimiters');

router.use(protect);
router.use(requireFeature('facilities_booking'));

router.route('/seats').get(getSeats);
router
  .route('/availability')
  .get(expensiveRouteLimiter, validate(getLabAvailabilityRouteSchema), getAvailability);
router.route('/bookings').post(validate(createBookingRouteSchema), createBooking);
router.route('/bookings/me').get(getMyBookings);
router.route('/bookings/:id').delete(validate(paramIdSchema), cancelBooking);
router.route('/bookings/:id/check-in').post(validate(paramIdSchema), checkInBooking);
router.route('/bookings/:id/check-out').post(validate(paramIdSchema), checkOutBooking);
router.route('/usage/me').get(getMyUsage);

// Admin Facilities Usage & CSV Export
router.route('/admin/usage').get(requireRole('college-admin', 'super-admin'), getAdminUsage);
router
  .route('/admin/usage/export')
  .get(requireRole('college-admin', 'super-admin'), exportAdminUsageCsv);

// Queue endpoints (§10.4 & §11)
router.route('/queue/join').post(joinQueue);
router.route('/queue/me').get(getMyQueue);
router.route('/queue/:id').delete(validate(paramIdSchema), leaveQueue);
router.route('/queue/:id/claim').post(validate(paramIdSchema), claimQueueSpot);

module.exports = router;
