const asyncHandler = require('../utils/asyncHandler');
const Loan = require('../models/Loan');
const Book = require('../models/Book');
const AppError = require('../utils/AppError');
const tenantScope = require('../utils/tenantScope');
const cursorPagination = require('../utils/cursorPagination');
const {
  checkoutBook,
  renewLoan: renewLoanService,
  returnBook,
} = require('../services/loanService');

// @desc    Get user's loans
// @route   GET /api/loans/me
// @access  Private
const getMyLoans = asyncHandler(async (req, res) => {
  const { status, limit = 10, cursor } = req.query;
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  // Securely scope with tenant wrapper
  const loanRepo = tenantScope(Loan, req);

  const filter = { userId: req.user.id };
  if (status && status !== 'all') {
    filter.status = status;
  }

  // If cursor pagination is requested, apply cursor
  const decodedCursor = cursorPagination.decode(cursor);
  if (decodedCursor) {
    cursorPagination.apply(filter, decodedCursor, 'newest');
  }

  // Find limit + 1 to check hasMore
  const loans = await loanRepo
    .find(filter)
    .populate('bookId', 'title author coverImage format')
    .sort({ createdAt: -1 })
    .limit(pageSize + 1);

  const hasMore = loans.length > pageSize;
  const slicedLoans = loans.slice(0, pageSize);

  let nextCursor = null;
  if (hasMore && slicedLoans.length > 0) {
    const lastItem = slicedLoans[slicedLoans.length - 1];
    nextCursor = cursorPagination.encode(new Date(lastItem.createdAt).getTime(), lastItem._id);
  }

  res.json({
    success: true,
    data: slicedLoans,
    pagination: {
      nextCursor,
      hasMore,
      limit: pageSize,
    },
  });
});

// @desc    Borrow a book
// @route   POST /api/loans/:bookId/borrow
// @access  Private
const borrowBookHandler = asyncHandler(async (req, res) => {
  const { bookId } = req.params;

  // Tenant-scope the book lookup
  const book = await Book.findOne({ _id: bookId, collegeId: req.user.collegeId });
  if (!book) {
    throw new AppError('Book not found or unauthorized access.', 404);
  }

  const loan = await checkoutBook(req.user.id, bookId, req.user.collegeId, req.user.id);
  res.json({ success: true, data: loan });
});

// @desc    Renew a loan
// @route   POST /api/loans/:id/renew
// @access  Private
const renewLoan = asyncHandler(async (req, res) => {
  try {
    const loan = await renewLoanService(req.params.id, req.user.id, req.user.collegeId);
    res.json({ success: true, data: loan });
  } catch (err) {
    if (err.code) {
      return res.status(400).json({
        success: false,
        error: err.code,
        message: err.message,
        meta: err.meta,
      });
    }
    throw err;
  }
});

// @desc    Return a loan
// @route   POST /api/loans/:id/return
// @access  Private
const returnLoanHandler = asyncHandler(async (req, res) => {
  // Let's verify the loan belongs to the user and their college
  const loanRecord = await Loan.findOne({
    _id: req.params.id,
    userId: req.user.id,
    collegeId: req.user.collegeId,
    status: { $in: ['active', 'overdue'] },
  });
  if (!loanRecord) {
    throw new AppError('Active loan not found or unauthorized access.', 404);
  }

  const loan = await returnBook(req.params.id, req.user.collegeId);
  res.json({ success: true, data: loan });
});

module.exports = {
  getMyLoans,
  borrowBookHandler,
  renewLoan,
  returnLoanHandler,
};
