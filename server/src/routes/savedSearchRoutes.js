const express = require('express');
const router = express.Router();
const { getMySavedSearches, createSavedSearch } = require('../controllers/savedSearchController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createSavedSearchSchema } = require('../validations/personalization.validation');

router.use(protect);

router.route('/').post(validate(createSavedSearchSchema), createSavedSearch);

router.route('/me').get(getMySavedSearches);

module.exports = router;
