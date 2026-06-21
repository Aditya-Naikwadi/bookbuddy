const express = require('express');
const router = express.Router();
const {
  getBooks,
  getBookById,
  getBookAvailability,
} = require('../controllers/bookController');

router.get('/', getBooks);
router.get('/:id', getBookById);
router.get('/:id/availability', getBookAvailability);

module.exports = router;
