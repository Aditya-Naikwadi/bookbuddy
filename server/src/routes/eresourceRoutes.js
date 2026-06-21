const express = require('express');
const router = express.Router();
const { listInternalResources, updateProgress } = require('../controllers/eresourceController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(listInternalResources);

router.route('/:id/progress')
  .post(updateProgress);

module.exports = router;
