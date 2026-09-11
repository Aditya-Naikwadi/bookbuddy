const asyncHandler = require('../utils/asyncHandler');
const Book = require('../models/Book');
const EResource = require('../models/EResource');
const Loan = require('../models/Loan');
const AppError = require('../utils/AppError');
const tenantScope = require('../utils/tenantScope');
const cursorPagination = require('../utils/cursorPagination');
const cacheHelper = require('../utils/cacheHelper');
const { checkoutBook, returnBook } = require('../services/loanService');

// Normalize Catalog Items for a uniform response
const normalizeItem = (item) => {
  const isBook = item.copiesTotal !== undefined;

  return {
    id: item._id,
    title: item.title,
    author: item.author,
    category: item.category,
    format: isBook ? item.format : 'ebook',
    copiesAvailable: isBook ? item.copiesAvailable : null,
    copiesTotal: isBook ? item.copiesTotal : null,
    shelfLocation: isBook ? item.shelfLocation : null,
    fileUrl: !isBook ? item.fileUrl : null,
    readUrl: !isBook ? item.readUrl || item.url : null,
    source: isBook ? 'catalog' : 'eresource',
    createdAt: item.createdAt,
    isbn: isBook ? item.isbn : null,
  };
};

/**
 * @desc    Search Unified Catalog (physical + digital)
 * @route   GET /api/v1/catalog/search
 * @access  Private
 */
const searchCatalog = asyncHandler(async (req, res) => {
  const {
    q = '',
    format = 'both',
    availability = 'all',
    category,
    sortBy = 'newest',
    cursor,
    limit = 10,
  } = req.query;

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const decodedCursor = cursorPagination.decode(cursor);

  // Enforce Tenant Isolation Wrapper
  const bookRepo = tenantScope(Book, req);
  const eresourceRepo = tenantScope(EResource, req);

  // Check Redis Cache first
  const cacheKey = cacheHelper.makeKey(
    req.user.collegeId,
    'search',
    `${q}:${format}:${availability}:${category}:${sortBy}:${cursor}:${parsedLimit}`
  );

  const cachedResults = await cacheHelper.get(cacheKey);
  if (cachedResults) {
    return res.json({ success: true, ...cachedResults });
  }

  // Build filters
  const bookFilter = {};
  const eresourceFilter = {};

  if (q.trim()) {
    bookFilter.$text = { $search: q.trim() };
    eresourceFilter.$text = { $search: q.trim() };
  }

  if (category && category !== 'all') {
    bookFilter.category = category;
    eresourceFilter.category = category;
  }

  // Filter: format (Physical / eBook / Both)
  const searchPhysical = format === 'physical' || format === 'both';
  const searchDigital = format === 'ebook' || format === 'both';

  // Filter: availability
  if (availability === 'available') {
    bookFilter.copiesAvailable = { $gt: 0 };
    // ebooks are always available, no restriction needed
  }

  // Push cursor filter into MongoDB query
  if (decodedCursor) {
    const { sortValue, lastId } = decodedCursor;
    if (sortBy === 'newest') {
      const cursorDate = new Date(Number(sortValue));
      if (!isNaN(cursorDate.getTime())) {
        const cursorCond = lastId
          ? {
              $or: [
                { createdAt: { $lt: cursorDate } },
                { createdAt: cursorDate, _id: { $lt: lastId } },
              ],
            }
          : { createdAt: { $lt: cursorDate } };

        bookFilter.$and = bookFilter.$and ? [...bookFilter.$and, cursorCond] : [cursorCond];
        eresourceFilter.$and = eresourceFilter.$and
          ? [...eresourceFilter.$and, cursorCond]
          : [cursorCond];
      }
    } else if (sortBy === 'title') {
      const cursorCond = lastId
        ? {
            $or: [{ title: { $gt: sortValue } }, { title: sortValue, _id: { $gt: lastId } }],
          }
        : { title: { $gt: sortValue } };

      bookFilter.$and = bookFilter.$and ? [...bookFilter.$and, cursorCond] : [cursorCond];
      eresourceFilter.$and = eresourceFilter.$and
        ? [...eresourceFilter.$and, cursorCond]
        : [cursorCond];
    }
  }

  // We query limit + 1 from both collections to evaluate hasMore
  let books = [];
  let eresources = [];

  const dbLimit = parsedLimit + 1;
  const sortConfig = sortBy === 'title' ? { title: 1, _id: 1 } : { createdAt: -1, _id: -1 };

  if (searchPhysical) {
    const booksQuery = bookRepo.find(bookFilter);
    books = await booksQuery.sort(sortConfig).limit(dbLimit);
  }

  if (searchDigital) {
    // Only fetch approved/published e-resources
    eresourceFilter.moderationStatus = { $in: ['approved', 'published'] };
    const eresourcesQuery = eresourceRepo.find(eresourceFilter);
    eresources = await eresourcesQuery.sort(sortConfig).limit(dbLimit);
  }

  // Normalize and combine
  const normalizedBooks = books.map(normalizeItem);
  const normalizedEResources = eresources.map(normalizeItem);
  let combined = [...normalizedBooks, ...normalizedEResources];

  // Sort merged results across physical + digital
  if (sortBy === 'newest') {
    combined.sort(
      (a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt) ||
        b.id.toString().localeCompare(a.id.toString())
    );
  } else if (sortBy === 'title') {
    combined.sort(
      (a, b) => a.title.localeCompare(b.title) || a.id.toString().localeCompare(b.id.toString())
    );
  }

  const hasMore = combined.length > parsedLimit;
  const slicedResults = combined.slice(0, parsedLimit);

  let nextCursor = null;
  if (hasMore && slicedResults.length > 0) {
    const lastItem = slicedResults[slicedResults.length - 1];
    const sortVal = sortBy === 'newest' ? new Date(lastItem.createdAt).getTime() : lastItem.title;
    nextCursor = cursorPagination.encode(sortVal, lastItem.id);
  }

  const responseEnvelope = {
    data: slicedResults,
    pagination: {
      nextCursor,
      hasMore,
      limit: parsedLimit,
    },
  };

  // Cache search result for 60 seconds
  await cacheHelper.set(cacheKey, responseEnvelope, 60);

  res.json({ success: true, ...responseEnvelope });
});

/**
 * @desc    Get details for catalog item
 * @route   GET /api/v1/catalog/:id
 * @access  Private
 */
const getCatalogItemDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const cacheKey = cacheHelper.makeKey(req.user.collegeId, 'detail', id);
  const cached = await cacheHelper.get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const bookRepo = tenantScope(Book, req);
  const eresourceRepo = tenantScope(EResource, req);

  let item = await bookRepo.findById(id);
  if (!item) {
    item = await eresourceRepo.findById(id);
  }

  if (!item) {
    throw new AppError('Catalog item not found or unauthorized access.', 404);
  }

  const normalized = normalizeItem(item);

  // Cache detail details for 5 minutes
  await cacheHelper.set(cacheKey, normalized, 300);

  res.json({ success: true, data: normalized });
});

/**
 * @desc    Borrow physical book atomically
 * @route   POST /api/v1/catalog/:id/borrow
 * @access  Private
 */
const borrowBookItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Verify book exists in tenant scope first
  const bookRepo = tenantScope(Book, req);
  const book = await bookRepo.findById(id);
  if (!book) {
    throw new AppError('Book not found or unauthorized access.', 404);
  }

  const loan = await checkoutBook(req.user.id, id, req.user.collegeId, req.user.id);

  // Evict cache keys
  await cacheHelper.del(cacheHelper.makeKey(req.user.collegeId, 'detail', id));

  res.json({ success: true, message: 'Book borrowed successfully', data: loan });
});

/**
 * @desc    Return physical book atomically
 * @route   POST /api/v1/catalog/:loanId/return
 * @access  Private
 */
const returnBookItem = asyncHandler(async (req, res) => {
  const { loanId } = req.params;

  // Verify active loan belongs to this tenant scope
  const loanRepo = tenantScope(Loan, req);
  const loanRecord = await loanRepo.findOne({
    _id: loanId,
    status: { $in: ['active', 'overdue'] },
  });
  if (!loanRecord) {
    throw new AppError('Active loan not found or unauthorized access.', 404);
  }

  const loan = await returnBook(loanId, req.user.collegeId);

  // Evict detail cache keys
  await cacheHelper.del(cacheHelper.makeKey(req.user.collegeId, 'detail', loan.bookId));

  res.json({ success: true, message: 'Book returned successfully', data: loan });
});

module.exports = {
  searchCatalog,
  getCatalogItemDetails,
  borrowBookItem,
  returnBookItem,
};
