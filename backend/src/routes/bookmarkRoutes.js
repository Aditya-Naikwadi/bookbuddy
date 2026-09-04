const express = require('express');
const router = express.Router();
const {
  getMyBookmarks,
  createBookmark,
  deleteBookmark,
} = require('../controllers/bookmarkController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');
const { createBookmarkSchema } = require('../validations/personalization.validation');

router.use(protect);

router.route('/').post(validate(createBookmarkSchema), createBookmark);

router.route('/me').get(getMyBookmarks);

router.route('/:id').delete(validate(paramIdSchema), deleteBookmark);

module.exports = router;
