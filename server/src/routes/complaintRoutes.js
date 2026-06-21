const express = require('express');
const router = express.Router();
const { submitComplaint, getMyComplaints } = require('../controllers/complaintController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/').post(submitComplaint).get(getMyComplaints);

module.exports = router;
