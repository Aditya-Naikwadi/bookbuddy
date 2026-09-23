const express = require('express');
const router = express.Router();
const {
  searchCatalog,
  getCatalogItemDetails,
  borrowBookItem,
  returnBookItem,
} = require('../controllers/catalogController');
const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const validate = require('../middlewares/validate');
const { paramIdSchema, paramLoanIdSchema } = require('@bookbuddy/shared/schemas/common');

// Protect all routes
router.use(protect);
router.use(scopeToTenant);

// Search catalog
router.get('/search', searchCatalog);

// Catalog item details
router.get('/:id', validate(paramIdSchema), getCatalogItemDetails);

// Borrow physical book
router.post('/:id/borrow', validate(paramIdSchema), borrowBookItem);

// Return physical book
router.post('/:loanId/return', validate(paramLoanIdSchema), returnBookItem);

module.exports = router;
