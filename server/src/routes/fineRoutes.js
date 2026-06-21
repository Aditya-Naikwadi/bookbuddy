const express = require('express');
const router = express.Router();
const {
  getMyFines,
  getMyFinesSummary,
  payFine,
} = require('../controllers/fineController');
const { protect } = require('../middlewares/auth');

router.get('/me', protect, getMyFines);
router.get('/me/summary', protect, getMyFinesSummary);
router.post('/:id/pay', protect, payFine);

module.exports = router;
