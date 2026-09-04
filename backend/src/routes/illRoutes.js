const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  searchILLCatalog,
  createILLRequest,
  getILLRequests,
  updateILLStatus,
} = require('../controllers/illProxyController');

router.use(protect);

router.get('/catalog', searchILLCatalog);
router.post('/request', createILLRequest);
router.get('/requests', getILLRequests);
router.patch('/requests/:id/status', updateILLStatus);

module.exports = router;
