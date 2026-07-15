const express = require('express');
const router = express.Router();
const {
  getLists,
  getListById,
  createList,
  updateList,
  deleteList,
} = require('../controllers/readingListController');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paramIdSchema } = require('../validations/common.validation');
const {
  createReadingListSchema,
  updateReadingListSchema,
} = require('../validations/personalization.validation');

router.use(protect);

router.route('/').get(getLists).post(validate(createReadingListSchema), createList);

router
  .route('/:id')
  .get(validate(paramIdSchema), getListById)
  .patch(validate(paramIdSchema), validate(updateReadingListSchema), updateList)
  .delete(validate(paramIdSchema), deleteList);

module.exports = router;
