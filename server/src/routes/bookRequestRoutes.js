const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middlewares/auth');
const {
  createBookRequest,
  getUserBookRequests,
  getAllBookRequests,
  updateBookRequestStatus,
} = require('../controllers/bookRequestController');

router.use(protect);

router.post('/', createBookRequest);
router.get('/me', getUserBookRequests);
router.get('/', requireRole('college-admin', 'admin', 'librarian'), getAllBookRequests);
router.patch(
  '/:id/status',
  requireRole('college-admin', 'admin', 'librarian'),
  updateBookRequestStatus
);

module.exports = router;
