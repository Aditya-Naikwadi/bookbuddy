const express = require('express');
const router = express.Router();
const {
  getMyBookmarks,
  createBookmark,
  deleteBookmark
} = require('../controllers/bookmarkController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .post(createBookmark);

router.route('/me')
  .get(getMyBookmarks);

router.route('/:id')
  .delete(deleteBookmark);

module.exports = router;
