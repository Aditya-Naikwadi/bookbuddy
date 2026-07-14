const express = require('express');
const router = express.Router();
const { submitComplaint, getMyComplaints } = require('../controllers/complaintController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createComplaintSchema } = require('../validations/facilities.validation');

router.use(protect);

router.route('/').post(validate(createComplaintSchema), submitComplaint).get(getMyComplaints);

module.exports = router;
