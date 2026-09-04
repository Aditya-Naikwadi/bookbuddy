const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middlewares/auth');
const {
  createItemReport,
  getUserItemReports,
  getAllItemReports,
  updateItemReportStatus,
} = require('../controllers/itemReportController');

router.use(protect);

router.post('/', createItemReport);
router.get('/me', getUserItemReports);
router.get('/', requireRole('college-admin', 'admin', 'librarian'), getAllItemReports);
router.patch(
  '/:id/status',
  requireRole('college-admin', 'admin', 'librarian'),
  updateItemReportStatus
);

module.exports = router;
