const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const profanityFilter = require('../middlewares/profanityFilter');
const {
  getResourceReviews,
  createReview,
  voteHelpful,
  flagReview,
} = require('../controllers/reviewController');

router.use(protect);
router.use(scopeToTenant);

router.get('/:resourceType/:resourceId', getResourceReviews);
router.post('/', profanityFilter, createReview);
router.post('/:id/helpful', voteHelpful);
router.post('/:id/flag', flagReview);

module.exports = router;
