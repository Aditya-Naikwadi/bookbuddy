const express = require('express');
const router = express.Router();
const {
  createStudent,
  getAllPatrons,
  getPatronDetails,
  checkoutBook,
  returnBook,
  getHoldQueue,
  addBook,
  updateBook,
  uploadCollegeResource,
  getPendingFines,
  processPayment,
  getHelpdeskTickets,
  resolveTicket,
  getAnalyticsSummary
} = require('../../controllers/dashboards/collegeAdminController');
const { protect, restrictTo } = require('../../middlewares/auth');

// Note: `college-admin` acts as the College Admin verifier. We also support 'admin' and 'librarian' as fallbacks.
router.use(protect, restrictTo('college-admin', 'admin', 'librarian'));

// Patron Management
router.route('/patrons')
  .get(getAllPatrons)
  .post(createStudent);
router.route('/patrons/:id').get(getPatronDetails);

// Circulation & Queue
router.route('/circulation/checkout').post(checkoutBook);
router.route('/circulation/return').post(returnBook);
router.route('/circulation/queue').get(getHoldQueue);

// Cataloging & DAM
router.route('/catalog')
  .post(addBook);
router.route('/catalog/:id')
  .put(updateBook);
router.route('/resources')
  .post(uploadCollegeResource);

// Fines & Ticketing
router.route('/fines').get(getPendingFines);
router.route('/fines/:id/pay').post(processPayment);
router.route('/helpdesk').get(getHelpdeskTickets);
router.route('/helpdesk/:id/resolve').put(resolveTicket);

// Analytics
router.route('/analytics/summary').get(getAnalyticsSummary);

module.exports = router;
