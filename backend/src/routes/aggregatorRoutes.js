const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middlewares/auth');
const {
  getAggregatedBooks,
  triggerAsyncSync,
  getJobStatus,
} = require('../controllers/aggregatorController');

// GET /api/v1/aggregator - Public/Authenticated aggregated books list (global, non-tenant-scoped)
router.get('/', getAggregatedBooks);

router.post('/sync', protect, requireRole('super-admin', 'college-admin'), triggerAsyncSync);
router.get('/jobs/:id', protect, requireRole('super-admin', 'college-admin'), getJobStatus);

module.exports = router;
