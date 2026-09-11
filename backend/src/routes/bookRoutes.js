const express = require('express');
const router = express.Router();
const { getBooks, getBookById, getBookAvailability } = require('../controllers/bookController');
const {
  createReview,
  getBookReviews,
  updateReview,
  deleteReview,
} = require('../controllers/reviewController');
const { watchBook, unwatchBook, getWatchStatus } = require('../controllers/watchController');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const { userLimiter } = require('../middlewares/rateLimiters');
const profanityFilter = require('../middlewares/profanityFilter');

router.use(protect);
router.use(scopeToTenant);

router.get('/', getBooks);
router.get('/:id/availability', validate(paramIdSchema), getBookAvailability);
router.get('/:id/reviews', getBookReviews);
router.post('/:id/reviews', userLimiter, profanityFilter, createReview);
router.put('/:id/reviews/:reviewId', userLimiter, profanityFilter, updateReview);
router.delete('/:id/reviews/:reviewId', deleteReview);
router.get('/:id/watch', getWatchStatus);
router.post('/:id/watch', watchBook);
router.delete('/:id/watch', unwatchBook);
router.get('/:id', validate(paramIdSchema), getBookById);

module.exports = router;
