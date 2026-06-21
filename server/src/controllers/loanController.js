const asyncHandler = require('../utils/asyncHandler');
const Loan = require('../models/Loan');
const { borrowBook, renewLoan: renewLoanService, returnLoan: returnLoanService } = require('../services/loanService');

// @desc    Get user's loans
// @route   GET /api/loans/me
// @access  Private
const getMyLoans = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const pageSize = Number(limit);
  const pageNumber = Number(page);

  let query = { userId: req.user._id };
  
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
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

// @desc    Borrow a book
// @route   POST /api/loans/:bookId/borrow
// @access  Private
const borrowBookHandler = asyncHandler(async (req, res) => {
  const loan = await borrowBook(req.user._id, req.params.bookId);
  res.json({ success: true, data: loan });
});

// @desc    Renew a loan
// @route   POST /api/loans/:id/renew
// @access  Private
const renewLoan = asyncHandler(async (req, res) => {
  const loan = await renewLoanService(req.params.id, req.user._id);
  res.json({ success: true, data: loan });
});

// @desc    Return a loan
// @route   POST /api/loans/:id/return
// @access  Private
const returnLoanHandler = asyncHandler(async (req, res) => {
  const loan = await returnLoanService(req.params.id, req.user._id);
  res.json({ success: true, data: loan });
});

module.exports = {
  getMyLoans,
  borrowBookHandler,
  renewLoan,
  returnLoanHandler
};
