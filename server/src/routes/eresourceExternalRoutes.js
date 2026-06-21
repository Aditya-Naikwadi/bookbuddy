const express = require('express');
const router = express.Router();
const {
  listExternal, 
  getExternalDetail, 
  openExternal, 
  proxyContent,
  updateReadingProgress
} = require('../controllers/eresourceExternalController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/').get(listExternal);
router.route('/:gutenbergId').get(getExternalDetail);
router.route('/:gutenbergId/open').post(openExternal);
router.route('/:id/content').get(proxyContent);
router.route('/:id/progress').post(updateReadingProgress);

module.exports = router;
