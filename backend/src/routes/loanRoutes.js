const express = require('express');
const router = express.Router();
const {
  getMyLoans,
  borrowBookHandler,
  renewLoan,
  returnLoanHandler,
} = require('../controllers/loanController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paramIdSchema, paramBookIdSchema } = require('../validations/common.validation');

router.use(protect);

router.get('/me', getMyLoans);
router.post('/:bookId/borrow', validate(paramBookIdSchema), borrowBookHandler);
router.post('/:id/renew', validate(paramIdSchema), renewLoan);
router.post('/:id/return', validate(paramIdSchema), returnLoanHandler);

module.exports = router;
