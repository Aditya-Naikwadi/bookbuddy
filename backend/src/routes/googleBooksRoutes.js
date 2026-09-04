const express = require('express');
const router = express.Router();
const {
  searchGoogleBooks,
  getGoogleBookById,
  importGoogleBook,
  seedGoogleBooks,
} = require('../controllers/googleBooksController');

// Public search and detail routes
router.get('/search', searchGoogleBooks);
router.get('/volume/:id', getGoogleBookById);

// Import and Seed routes
router.post('/import', importGoogleBook);
router.post('/seed', seedGoogleBooks);

module.exports = router;
