// College Admin Dashboard Route mounts.
const express = require('express');
const router = express.Router();
const {
  createStudent,
  getAllPatrons,
  getPatronDetails,
  checkoutBook,
  returnBook,
  getCirculationQueue,
  addBook,
  updateBook,
  uploadCollegeResource,
  getCollegeFines,
  payCollegeFine,
  getPendingEResources,
  moderateEResource,
  getHelpdeskTickets,
  resolveTicket,
  getAnalyticsSummary,
  getLabSeats,
  createLabSeat,
  updateLabSeat,
  getLabBookings,
  getBookSuggestions,
  updateBookSuggestion,
  getFeedback,
} = require('../../controllers/dashboards/collegeAdminController');
const { protect, requireRole } = require('../../middlewares/auth');
const scopeToTenant = require('../../middlewares/scopeToTenant');
const validate = require('../../middlewares/validate');
const auditLog = require('../../middlewares/auditLog');
const { paramIdSchema } = require('../../validations/common.validation');
const {
  checkoutSchema,
  returnSchema,
  payFineSchema,
  createBookSchema,
  updateBookSchema,
  uploadResourceSchema,
  createStudentSchema,
} = require('../../validations/library.validation');
const { moderateSchema } = require('../../validations/personalization.validation');
const {
  createSeatSchema,
  updateSeatSchema,
  updateSuggestionSchema,
  resolveComplaintSchema,
} = require('../../validations/facilities.validation');

const { userLimiter, expensiveRouteLimiter } = require('../../middlewares/rateLimiters');

// Note: `college-admin` acts as the College Admin verifier. We also support 'admin' and 'librarian' as fallbacks.
router.use(protect, requireRole('college-admin', 'admin', 'librarian'));
router.use(scopeToTenant);
router.use(userLimiter);

// Patron Management
router.route('/patrons').get(getAllPatrons).post(validate(createStudentSchema), createStudent);
router.route('/patrons/:id').get(validate(paramIdSchema), getPatronDetails);

// Circulation & Queue
router
  .route('/circulation/checkout')
  .post(validate(checkoutSchema), auditLog('circulation.checkout'), checkoutBook);
router
  .route('/circulation/return')
  .post(validate(returnSchema), auditLog('circulation.return'), returnBook);
router.route('/circulation/queue').get(getCirculationQueue);

// Cataloging & DAM
router.route('/catalog').post(validate(createBookSchema), addBook);
router.route('/catalog/:id').put(validate(paramIdSchema), validate(updateBookSchema), updateBook);
router.route('/resources').post(validate(uploadResourceSchema), uploadCollegeResource);

// Moderation
router.route('/eresources/pending').get(getPendingEResources);
router
  .route('/eresources/:id/moderate')
  .put(validate(paramIdSchema), validate(moderateSchema), moderateEResource);

// Fines & Ticketing
router.route('/fines').get(getCollegeFines);
router
  .route('/fines/:id/pay')
  .post(validate(paramIdSchema), validate(payFineSchema), auditLog('fine.pay'), payCollegeFine);
router.route('/helpdesk').get(getHelpdeskTickets);
router
  .route('/helpdesk/:id/resolve')
  .put(
    validate(paramIdSchema),
    validate(resolveComplaintSchema),
    auditLog('complaint.resolve'),
    resolveTicket
  );

// Lab Inventory & Booking Management
router
  .route('/lab-seats')
  .get(getLabSeats)
  .post(validate(createSeatSchema), auditLog('lab_seat.create'), createLabSeat);
router
  .route('/lab-seats/:id')
  .put(
    validate(paramIdSchema),
    validate(updateSeatSchema),
    auditLog('lab_seat.update'),
    updateLabSeat
  );
router.route('/lab-bookings').get(getLabBookings);

// Book Suggestions Moderation
router.route('/book-suggestions').get(getBookSuggestions);
router
  .route('/book-suggestions/:id')
  .put(
    validate(paramIdSchema),
    validate(updateSuggestionSchema),
    auditLog('suggestion.moderate'),
    updateBookSuggestion
  );

// Feedback Logs
router.route('/feedback').get(getFeedback);

// Analytics
router.route('/analytics/summary').get(expensiveRouteLimiter, getAnalyticsSummary);

module.exports = router;
