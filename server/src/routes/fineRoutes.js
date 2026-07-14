const express = require('express');
const router = express.Router();
const { getMyFines, getMyFinesSummary, payFine } = require('../controllers/fineController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');

router.get('/me', protect, getMyFines);
router.get('/me/summary', protect, getMyFinesSummary);
router.post('/:id/pay', protect, validate(paramIdSchema), payFine);

module.exports = router;
