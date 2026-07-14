const express = require('express');
const router = express.Router();
const { submitFeedback, getFeedback } = require('../controllers/feedbackController');
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const validate = require('../middlewares/validate');
const { createFeedbackSchema } = require('../validations/facilities.validation');

router.use(protect);
router.use(scopeToTenant);

router.route('/').post(validate(createFeedbackSchema), submitFeedback).get(getFeedback);

module.exports = router;
