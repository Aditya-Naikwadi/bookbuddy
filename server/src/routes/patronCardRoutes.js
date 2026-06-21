const express = require('express');
const router = express.Router();
const { getMyPatronCard } = require('../controllers/patronCardController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/me').get(getMyPatronCard);

module.exports = router;
