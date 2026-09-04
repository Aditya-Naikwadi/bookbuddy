// Acquisition & Serials routes.
const express = require('express');
const router = express.Router();
const {
  getAcquisitions,
  getAcquisitionStats,
  getAcquisitionById,
  createAcquisitionOrder,
  updateOrderStatus,
  deleteAcquisitionOrder,
} = require('../controllers/acquisitionController');
const { protect, requireRole, requirePermission } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const { userLimiter } = require('../middlewares/rateLimiters');
const auditLog = require('../middlewares/auditLog');

router.use(protect);
router.use(requireRole('college-admin', 'admin', 'librarian', 'super-admin'));
router.use(scopeToTenant);
router.use(userLimiter);

router
  .route('/')
  .get(getAcquisitions)
  .post(
    requirePermission('canManageAcquisitions'),
    auditLog('acquisition.create'),
    createAcquisitionOrder
  );

router.route('/stats').get(getAcquisitionStats);

router
  .route('/:id')
  .get(getAcquisitionById)
  .delete(
    requirePermission('canManageAcquisitions'),
    auditLog('acquisition.delete'),
    deleteAcquisitionOrder
  );

router
  .route('/:id/status')
  .patch(
    requirePermission('canManageAcquisitions'),
    auditLog('acquisition.update_status'),
    updateOrderStatus
  );

module.exports = router;
