const express = require('express');
const router = express.Router();
const {
  getMyLoans,
  borrowBookHandler,
  renewLoan,
  returnLoanHandler
} = require('../controllers/loanController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/me', getMyLoans);
router.post('/:bookId/borrow', borrowBookHandler);
router.post('/:id/renew', renewLoan);
router.post('/:id/return', returnLoanHandler);

module.exports = router;
