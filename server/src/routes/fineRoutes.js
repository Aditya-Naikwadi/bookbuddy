const express = require('express');
const router = express.Router();
const {
  getMyFines,
  getMyFinesSummary,
  payFine,
  payAllFines,
} = require('../controllers/fineController');
const { protect } = require('../middlewares/auth');
const idempotency = require('../middlewares/idempotency');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');

router.use(protect);

router.get('/me', getMyFines);
router.get('/me/summary', getMyFinesSummary);

router.post('/pay-all', idempotency, payAllFines);
router.post('/:id/pay', validate(paramIdSchema), idempotency, payFine);

module.exports = router;
