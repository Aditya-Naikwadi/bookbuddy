const express = require('express');
const router = express.Router();
const {
  getStudentDashboardSummary,
  searchCatalog,
  getRecommendations,
  getEResources,
  getMyLoans,
  renewLoan,
  placeHold,
  getMyQueue,
  getMyFines
} = require('../../controllers/dashboards/studentDashboardController');
const { protect, restrictTo } = require('../../middlewares/auth');

// Base route: /api/dashboards/student

// Apply middleware to all routes in this file
router.use(protect);
router.use(restrictTo('student'));

// Summary Route
router.get('/', getStudentDashboardSummary);

// Catalog & OPAC
router.get('/catalog', searchCatalog);
router.get('/catalog/recommendations', getRecommendations);

// Digital Assets
router.get('/eresources', getEResources);

// Circulation & Loans
router.get('/loans', getMyLoans);
router.post('/loans/:id/renew', renewLoan);

// Reservations & Holds
router.post('/reservations', placeHold);
router.get('/reservations/queue', getMyQueue);

// Fines
router.get('/fines', getMyFines);

module.exports = router;
