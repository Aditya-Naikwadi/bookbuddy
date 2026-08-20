const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const { getLeaderboard } = require('../controllers/leaderboardController');

router.use(protect);
router.use(scopeToTenant);

router.get('/', getLeaderboard);

module.exports = router;
