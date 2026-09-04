const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { getDigitalCardToken } = require('../controllers/digitalCardController');

router.use(protect);

router.get('/token', getDigitalCardToken);

module.exports = router;
