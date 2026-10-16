const express = require('express');
const router = express.Router();
const { getInventory } = require('../controllers/inventoryController');
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');

// Protect and tenant-scope all inventory routes
router.use(protect);
router.use(scopeToTenant);

router.get('/', getInventory);

module.exports = router;
