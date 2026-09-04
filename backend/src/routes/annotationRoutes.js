const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect } = require('../middlewares/auth');
const requireFeature = require('../middlewares/requireFeature');
const {
  createAnnotation,
  getAnnotations,
  updateAnnotation,
  deleteAnnotation,
  syncAnnotations,
  exportAnnotations,
  searchAnnotations,
} = require('../controllers/annotationController');

router.use(protect);
router.use(requireFeature('digital_annotations'));

router.get('/search', searchAnnotations);
router.post('/sync', syncAnnotations);
router.get('/export', exportAnnotations);

router.route('/').get(getAnnotations).post(createAnnotation);

router
  .route('/:id')
  .get(async (req, res, next) => {
    // Single fetch fallback if needed
    return getAnnotations(req, res, next);
  })
  .patch(updateAnnotation)
  .put(updateAnnotation)
  .delete(deleteAnnotation);

module.exports = router;
