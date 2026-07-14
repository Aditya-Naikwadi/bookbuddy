const express = require('express');
const router = express.Router();
const { getBooks, getBookById, getBookAvailability } = require('../controllers/bookController');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');

router.use(protect);
router.use(scopeToTenant);

router.get('/', getBooks);
router.get('/:id', validate(paramIdSchema), getBookById);
router.get('/:id/availability', validate(paramIdSchema), getBookAvailability);

module.exports = router;
