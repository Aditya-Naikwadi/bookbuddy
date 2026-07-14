const express = require('express');
const router = express.Router();
const {
  listExternal,
  getExternalDetail,
  openExternal,
  proxyContent,
  updateReadingProgress,
} = require('../controllers/eresourceExternalController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paramIdSchema, paramGutenbergIdSchema } = require('../validations/common.validation');
const { updateProgressSchema } = require('../validations/personalization.validation');

router.use(protect);

router.route('/').get(listExternal);
router.route('/:gutenbergId').get(validate(paramGutenbergIdSchema), getExternalDetail);
router.route('/:gutenbergId/open').post(validate(paramGutenbergIdSchema), openExternal);
router.route('/:id/content').get(validate(paramIdSchema), proxyContent);
router.route('/:id/progress').post(validate(paramIdSchema), validate(updateProgressSchema), updateReadingProgress);

module.exports = router;
