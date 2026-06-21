const express = require('express');
const router = express.Router();
const {
  getMyLoans,
  renewLoan,
} = require('../controllers/loanController');
const { protect } = require('../middlewares/auth');

router.get('/me', protect, getMyLoans);
router.post('/:id/renew', protect, renewLoan);

module.exports = router;
