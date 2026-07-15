const express = require('express');
const router = express.Router();
const { listInternalResources, updateProgress } = require('../controllers/eresourceController');
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');
const { updateProgressSchema } = require('../validations/personalization.validation');

router.use(protect);
router.use(scopeToTenant);

router.route('/').get(listInternalResources);

router.route('/:eresourceId/progress').post(validate(updateProgressSchema), updateProgress);

module.exports = router;
