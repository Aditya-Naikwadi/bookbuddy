const express = require('express');
const router = express.Router();
const {
  suggestBook,
  getSuggestions,
  upvoteSuggestion,
} = require('../controllers/bookSuggestionController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');
const { createSuggestionSchema } = require('../validations/facilities.validation');

router.use(protect);

router.route('/').post(validate(createSuggestionSchema), suggestBook).get(getSuggestions);
router.route('/:id/upvote').post(validate(paramIdSchema), upvoteSuggestion);

module.exports = router;
