const asyncHandler = require('../utils/asyncHandler');
const Book = require('../models/Book');
const tenantScope = require('../utils/tenantScope');
const cursorPagination = require('../utils/cursorPagination');
const { escapeRegExp } = require('../utils/sanitize');

/**
 * @desc    Get tenant inventory with role-based field redaction and server-side filtering
 * @route   GET /api/v1/inventory
 * @access  Private
 */
const getInventory = asyncHandler(async (req, res) => {
  const { q, genre, shelfLocation, availability, cursor, page, limit = 25 } = req.query;

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const bookRepo = tenantScope(Book, req);
  const userRole = req.user?.role || 'student';

  const filter = {};

  if (q && q.trim()) {
    const escaped = escapeRegExp(q.trim());
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { author: { $regex: escaped, $options: 'i' } },
      { isbn: { $regex: `^${escaped}`, $options: 'i' } },
    ];
  }

  if (genre && genre !== 'All' && genre !== 'all') {
    filter.genre = genre;
  }

  if (shelfLocation && shelfLocation.trim()) {
    const escapedShelf = escapeRegExp(shelfLocation.trim());
    filter.shelfLocation = { $regex: `^${escapedShelf}`, $options: 'i' };
  }

  if (availability === 'available') {
    filter.copiesAvailable = { $gt: 0 };
  } else if (availability === 'unavailable') {
    filter.copiesAvailable = 0;
  }

  // Role-based field projection
  const isLibrarianOrAdmin = userRole === 'librarian' || userRole === 'college_admin';
  const isSuperAdmin = userRole === 'super-admin';

  let selectFields =
    'title author isbn coverImage genre category copiesAvailable reservedCopies copiesTotal format isShareableAcrossColleges collegeId createdAt';

  if (isLibrarianOrAdmin || isSuperAdmin) {
    selectFields += ' deweyDecimal shelfLocation callNumber';
  }

  if (isLibrarianOrAdmin) {
    selectFields += ' purchasePrice';
  }

  const decodedCursor = cursorPagination.decode(cursor);
  if (decodedCursor) {
    const { sortValue, lastId } = decodedCursor;
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

      filter.$and = filter.$and ? [...filter.$and, cursorCond] : [cursorCond];
    }
  }

  const query = bookRepo.find(filter).select(selectFields).lean();

  if (page) {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * parsedLimit;
    const total = await bookRepo.countDocuments(filter);
    const books = await query.sort({ createdAt: -1, _id: -1 }).skip(skip).limit(parsedLimit);

    return res.json({
      success: true,
      data: books,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / parsedLimit) || 1,
        limit: parsedLimit,
      },
    });
  }

  // Default Cursor-based pagination
  const dbLimit = parsedLimit + 1;
  const items = await query.sort({ createdAt: -1, _id: -1 }).limit(dbLimit);

  const hasMore = items.length > parsedLimit;
  const slicedResults = items.slice(0, parsedLimit);

  let nextCursor = null;
  if (hasMore && slicedResults.length > 0) {
    const lastItem = slicedResults[slicedResults.length - 1];
    nextCursor = cursorPagination.encode(new Date(lastItem.createdAt).getTime(), lastItem._id);
  }

  res.json({
    success: true,
    data: slicedResults,
    pagination: {
      nextCursor,
      hasMore,
      limit: parsedLimit,
    },
  });
});

module.exports = {
  getInventory,
};
