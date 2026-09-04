const express = require('express');
const router = express.Router();
const {
  getLists,
  getListById,
  createList,
  updateList,
  deleteList,
  addListItem,
  deleteListItem,
} = require('../controllers/readingListController');
const { protect } = require('../middlewares/auth');
const bindTenantContext = require('../middlewares/tenantScoping');
const validate = require('../middlewares/validate');
const { paramIdSchema, paramIdAndBookIdSchema } = require('../validations/common.validation');
const {
  createReadingListSchema,
  updateReadingListSchema,
  addReadingListItemSchema,
} = require('../validations/personalization.validation');

router.use(protect);
router.use(bindTenantContext); // F0.1 Tenant Scoping Context

router.route('/').get(getLists).post(validate(createReadingListSchema), createList);

router
  .route('/:id')
  .get(validate(paramIdSchema), getListById)
  .patch(validate(paramIdSchema), validate(updateReadingListSchema), updateList)
  .put(validate(paramIdSchema), validate(updateReadingListSchema), updateList)
  .delete(validate(paramIdSchema), deleteList);

router
  .route('/:id/items')
  .post(validate(paramIdSchema), validate(addReadingListItemSchema), addListItem);

router.route('/:id/items/:bookId').delete(validate(paramIdAndBookIdSchema), deleteListItem);

module.exports = router;
