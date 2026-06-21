const express = require('express');
const router = express.Router();
const {
  getMySavedSearches,
  createSavedSearch
} = require('../controllers/savedSearchController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .post(createSavedSearch);

router.route('/me')
  .get(getMySavedSearches);

module.exports = router;
