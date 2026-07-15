const asyncHandler = require('../utils/asyncHandler');
const Loan = require('../models/Loan');
const Book = require('../models/Book');
const AppError = require('../utils/AppError');
const {
  checkoutBook,
  renewLoan: renewLoanService,
  returnBook,
} = require('../services/loanService');

// @desc    Get user's loans
// @route   GET /api/loans/me
// @access  Private
const getMyLoans = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const pageSize = Number(limit);
  const pageNumber = Number(page);

  let query = { userId: req.user.id, collegeId: req.user.collegeId };

  if (status && status !== 'all') {
    query.status = status;
  }

  const total = await Loan.countDocuments(query);
  const loans = await Loan.find(query)
    .populate('bookId', 'title author coverImage format')
    .sort({ issueDate: -1 })
    .limit(pageSize)
    .skip(pageSize * (pageNumber - 1));

  res.json({
    success: true,
    data: loans,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
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
  const loanRecord = await Loan.findOne({
    _id: req.params.id,
    userId: req.user.id,
    collegeId: req.user.collegeId,
  });
  if (!loanRecord) {
    throw new AppError('Active loan not found or unauthorized access.', 404);
  }

  const loan = await renewLoanService(req.params.id, req.user.id);
  res.json({ success: true, data: loan });
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
