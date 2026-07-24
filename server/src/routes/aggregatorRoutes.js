const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middlewares/auth');
const { triggerAsyncSync, getJobStatus } = require('../controllers/aggregatorController');

router.post('/sync', protect, requireRole('super-admin', 'college-admin'), triggerAsyncSync);
router.get('/jobs/:id', protect, requireRole('super-admin', 'college-admin'), getJobStatus);

module.exports = router;
