// Student Dashboard Route mounts.
const express = require('express');
const router = express.Router();
const {
  getStudentReadingAnalytics,
  getStudentOverview,
  getStudentCatalog,
  getStudentRecommendations,
  getStudentLoans,
  renewStudentLoan,
  placeStudentHold,
  getStudentQueuePosition,
  getStudentFines,
  getStudentEResources,
  getStudentEResourceDetails,
  uploadStudentEResource,
  getStudentReadingLists,
  getStudentReadingListDetails,
  createStudentReadingList,
  updateStudentReadingList,
  deleteStudentReadingList,
  addReadingListItem,
  deleteReadingListItem,
  getReadingProgress,
  upsertReadingProgress,
  getStudentBookmarks,
  createStudentBookmark,
  deleteStudentBookmark,
  getStudentSavedSearches,
  saveStudentSearch,
  deleteStudentSearch,
  toggleSavedSearchAlerts,
  getLabsAvailability,
  createLabBooking,
  cancelLabBooking,
  getStudentLabBookings,
  createBookSuggestion,
  getStudentBookSuggestions,
  createFeedback,
  createComplaint,
  getStudentComplaints,
  getStudentStreak,
  getStudentStickers,
  getStudentNotifications,
  readStudentNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
} = require('../../controllers/dashboards/studentDashboardController');
const { protect, requireRole } = require('../../middlewares/auth');
const scopeToTenant = require('../../middlewares/scopeToTenant');
const validate = require('../../middlewares/validate');
const {
  paramIdSchema,
  paramEResourceIdSchema,
  paramIdAndItemIdSchema,
} = require('../../validations/common.validation');
const {
  placeHoldSchema,
  getQueueSchema,
  renewLoanSchema,
} = require('../../validations/library.validation');
const {
  createEResourceSchema,
  createReadingListSchema,
  updateReadingListSchema,
  addReadingListItemSchema,
  updateProgressSchema,
  createBookmarkSchema,
  createSavedSearchSchema,
  toggleAlertsSchema,
} = require('../../validations/personalization.validation');
const {
  getAvailabilitySchema,
  createBookingSchema,
  createSuggestionSchema,
  createFeedbackSchema,
  createComplaintSchema,
  updateNotificationPreferencesSchema,
} = require('../../validations/facilities.validation');
const { userLimiter, expensiveRouteLimiter } = require('../../middlewares/rateLimiters');

// Apply middleware gates to all routes
router.use(protect);
router.use(requireRole('student'));
router.use(scopeToTenant);
router.use(userLimiter);

// Aggregated Dashboard Overview & Analytics
router.get('/overview', getStudentOverview);
router.get('/reading-analytics', getStudentReadingAnalytics);

// Catalog & OPAC
router.get('/catalog', expensiveRouteLimiter, getStudentCatalog);
router.get('/catalog/recommendations', expensiveRouteLimiter, getStudentRecommendations);

// Circulation & Loans
router.get('/loans', getStudentLoans);
router.post('/loans/:id/renew', validate(renewLoanSchema), renewStudentLoan);

// Reservations & Holds
router.post('/reservations', expensiveRouteLimiter, validate(placeHoldSchema), placeStudentHold);
router.get('/reservations/queue', validate(getQueueSchema), getStudentQueuePosition);

// Fines
router.get('/fines', getStudentFines);

// EResources
router.get('/eresources', getStudentEResources);
router.get(
  '/eresources/my-submissions',
  require('../../controllers/eresourceController').getMySubmissions
);
router.get('/eresources/:id', validate(paramIdSchema), getStudentEResourceDetails);
router.post('/eresources', validate(createEResourceSchema), uploadStudentEResource);

// Reading Lists
router
  .route('/reading-lists')
  .get(getStudentReadingLists)
  .post(validate(createReadingListSchema), createStudentReadingList);
router
  .route('/reading-lists/:id')
  .get(validate(paramIdSchema), getStudentReadingListDetails)
  .put(validate(paramIdSchema), validate(updateReadingListSchema), updateStudentReadingList)
  .delete(validate(paramIdSchema), deleteStudentReadingList);
router.post(
  '/reading-lists/:id/items',
  validate(paramIdSchema),
  validate(addReadingListItemSchema),
  addReadingListItem
);
router.delete(
  '/reading-lists/:id/items/:itemId',
  validate(paramIdAndItemIdSchema),
  deleteReadingListItem
);

// Reading Progress
router
  .route('/reading-progress/:eresourceId')
  .get(validate(paramEResourceIdSchema), getReadingProgress)
  .put(
    expensiveRouteLimiter,
    validate(paramEResourceIdSchema),
    validate(updateProgressSchema),
    upsertReadingProgress
  );

// Bookmarks
router
  .route('/bookmarks')
  .get(getStudentBookmarks)
  .post(validate(createBookmarkSchema), createStudentBookmark);
router.delete('/bookmarks/:id', validate(paramIdSchema), deleteStudentBookmark);

// Saved Searches
router
  .route('/saved-searches')
  .get(getStudentSavedSearches)
  .post(validate(createSavedSearchSchema), saveStudentSearch);
router.delete('/saved-searches/:id', validate(paramIdSchema), deleteStudentSearch);
router.patch(
  '/saved-searches/:id/alerts',
  validate(paramIdSchema),
  validate(toggleAlertsSchema),
  toggleSavedSearchAlerts
);

// Labs & Bookings
router.get('/labs/availability', validate(getAvailabilitySchema), getLabsAvailability);
router.post('/lab-bookings', validate(createBookingSchema), createLabBooking);
router.delete('/lab-bookings/:id', validate(paramIdSchema), cancelLabBooking);
router.get('/lab-bookings', getStudentLabBookings);

// Book Suggestions
router.post('/book-suggestions', validate(createSuggestionSchema), createBookSuggestion);
router.get('/book-suggestions', getStudentBookSuggestions);

// Feedback
router.post('/feedback', validate(createFeedbackSchema), createFeedback);

// Complaints
router.post('/complaints', validate(createComplaintSchema), createComplaint);
router.get('/complaints', getStudentComplaints);

// Streak & Gamification
router.get('/streak', getStudentStreak);
router.get('/stickers', getStudentStickers);

// Notifications
router.get('/notifications', getStudentNotifications);
router.patch('/notifications/:id/read', validate(paramIdSchema), readStudentNotification);
router.get('/notification-preferences', getNotificationPreferences);
router.put(
  '/notification-preferences',
  validate(updateNotificationPreferencesSchema),
  updateNotificationPreferences
);

module.exports = router;
