const express = require('express');
const router = express.Router();
const { submitComplaint, getMyComplaints } = require('../controllers/complaintController');
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const validate = require('../middlewares/validate');
const { createComplaintSchema } = require('@bookbuddy/shared/schemas/facilities');

router.use(protect);
router.use(scopeToTenant);

router.route('/').post(validate(createComplaintSchema), submitComplaint).get(getMyComplaints);

module.exports = router;
