const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const { getAnnouncements, toggleRSVP } = require('../controllers/announcementController');

router.use(protect);
router.use(scopeToTenant);

router.get('/', getAnnouncements);
router.post('/:id/rsvp', toggleRSVP);

module.exports = router;
