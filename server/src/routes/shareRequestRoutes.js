const express = require('express');
const router = express.Router();
const {
  createShareRequest,
  updateShareRequestStatus,
  getIncomingShareRequests,
  getShareRequests,
} = require('../controllers/shareRequestController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/incoming', getIncomingShareRequests);

router.route('/').post(createShareRequest).get(getShareRequests);

router.route('/:id').patch(updateShareRequestStatus);

module.exports = router;
