const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const { subscribeAlert, getUserAlerts } = require('../controllers/availabilityAlertController');

router.use(protect);
router.use(scopeToTenant);

router.get('/', getUserAlerts);
router.post('/', subscribeAlert);

module.exports = router;
