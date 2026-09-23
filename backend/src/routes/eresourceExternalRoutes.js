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
const { paramIdSchema, paramGutenbergIdSchema } = require('@bookbuddy/shared/schemas/common');
const { updateProgressSchema } = require('@bookbuddy/shared/schemas/personalization');

router.use(protect);

router.route('/').get(listExternal);
router.route('/:gutenbergId').get(validate(paramGutenbergIdSchema), getExternalDetail);
router.route('/:gutenbergId/open').post(validate(paramGutenbergIdSchema), openExternal);
router.route('/:id/content').get(validate(paramIdSchema), proxyContent);
router.route('/:eresourceId/progress').post(validate(updateProgressSchema), updateReadingProgress);

module.exports = router;
