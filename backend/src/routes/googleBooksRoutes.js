const express = require('express');
const router = express.Router();
const {
  searchGoogleBooks,
  getGoogleBookById,
  importGoogleBook,
  seedGoogleBooks,
} = require('../controllers/googleBooksController');

const { protect, requireRole } = require('../middlewares/auth');

// Public search and detail routes
router.get('/search', searchGoogleBooks);
router.get('/volume/:id', getGoogleBookById);

// Import and Seed routes (Protected for staff/admins)
router.post(
  '/import',
  protect,
  requireRole('college-admin', 'admin', 'librarian', 'super-admin'),
  importGoogleBook
);
router.post('/seed', protect, requireRole('super-admin'), seedGoogleBooks);

module.exports = router;
