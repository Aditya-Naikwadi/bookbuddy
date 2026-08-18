const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  getUserShelves,
  createShelf,
  getShelfById,
  updateShelf,
  deleteShelf,
  addBookToShelf,
  removeBookFromShelf,
} = require('../controllers/shelfController');

router.use(protect);

router.route('/').get(getUserShelves).post(createShelf);

router.route('/:id').get(getShelfById).patch(updateShelf).delete(deleteShelf);

router.post('/:id/books', addBookToShelf);
router.delete('/:id/books/:bookId', removeBookFromShelf);

module.exports = router;
