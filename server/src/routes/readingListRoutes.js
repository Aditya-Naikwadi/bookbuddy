const express = require('express');
const router = express.Router();
const {
  getLists,
  getListById,
  createList,
  updateList,
  deleteList
} = require('../controllers/readingListController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.route('/')
  .get(getLists)
  .post(createList);

router.route('/:id')
  .get(getListById)
  .patch(updateList)
  .delete(deleteList);

module.exports = router;
