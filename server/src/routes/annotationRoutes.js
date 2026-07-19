const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  createAnnotation,
  getAnnotations,
  updateAnnotation,
  deleteAnnotation,
  searchAnnotations,
} = require('../controllers/annotationController');

router.use(protect);

router.get('/search', searchAnnotations);
router.route('/').get(getAnnotations).post(createAnnotation);

router.route('/:id').put(updateAnnotation).delete(deleteAnnotation);

module.exports = router;
