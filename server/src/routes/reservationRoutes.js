const express = require('express');
const router = express.Router();
const {
  joinQueueHandler,
  getMyReservations,
  leaveQueueHandler
} = require('../controllers/reservationController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .post(joinQueueHandler);

router.route('/me')
  .get(getMyReservations);

router.route('/:id')
  .delete(leaveQueueHandler);

module.exports = router;
