const express = require('express');
const router = express.Router();
const { submitFeedback, getFeedback } = require('../controllers/feedbackController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/').post(submitFeedback).get(getFeedback);

module.exports = router;
