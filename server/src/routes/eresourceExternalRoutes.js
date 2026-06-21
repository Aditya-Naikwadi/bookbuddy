const express = require('express');
const router = express.Router();
const { 
  listExternal, 
  getExternalDetail, 
  openExternal, 
  proxyContent 
} = require('../controllers/eresourceExternalController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/').get(listExternal);
router.route('/:gutenbergId').get(getExternalDetail);
router.route('/:gutenbergId/open').post(openExternal);
router.route('/:id/content').get(proxyContent);

module.exports = router;
