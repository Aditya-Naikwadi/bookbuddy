const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect } = require('../middlewares/auth');

const {
  getCollegeBooks,
  getCollegeBookStats,
  getCollegeNewArrivals,
  searchCollegeBooks,
  getCollegeBooksBatch,
  getCollegeBookById,
  createCollegeBook,
} = require('../controllers/collegeBookController');

// Optional authentication middleware: Populates req.user if Bearer token present
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return protect(req, res, next);
  }
  next();
};

router.use(optionalAuth);

// Order is critical: Specific named routes before parameterized :bookId route
router.get('/stats', getCollegeBookStats);
router.get('/new-arrivals', getCollegeNewArrivals);
router.get('/search', searchCollegeBooks);
router.get('/batch', getCollegeBooksBatch);
router.get('/', getCollegeBooks);
router.post('/', protect, createCollegeBook);
router.get('/:bookId', getCollegeBookById);

module.exports = router;
