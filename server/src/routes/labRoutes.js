const express = require('express');
const router = express.Router();
const { getSeats, createBooking, getMyBookings, cancelBooking } = require('../controllers/labController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/seats').get(getSeats);
router.route('/bookings').post(createBooking);
router.route('/bookings/me').get(getMyBookings);
router.route('/bookings/:id').delete(cancelBooking);

module.exports = router;
