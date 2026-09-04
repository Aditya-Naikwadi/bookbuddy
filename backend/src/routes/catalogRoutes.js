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
const { z } = require('zod');

// Schema for input parameter validation
const paramIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

const paramLoanIdSchema = z.object({
  params: z.object({
    loanId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

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
