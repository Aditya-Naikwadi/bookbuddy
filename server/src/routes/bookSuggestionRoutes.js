const express = require('express');
const router = express.Router();
const { suggestBook, getSuggestions, upvoteSuggestion } = require('../controllers/bookSuggestionController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/').post(suggestBook).get(getSuggestions);
router.route('/:id/upvote').post(upvoteSuggestion);

module.exports = router;
