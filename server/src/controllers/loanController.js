const Loan = require('../models/Loan');
const Book = require('../models/Book');
const asyncHandler = require('express-async-handler');

// @desc    Get user's loans
// @route   GET /api/loans/me
// @access  Private
const getMyLoans = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const pageSize = Number(limit) || 10;
  const pageNumber = Number(page) || 1;

  let query = { userId: req.user._id };
  
  if (status && status !== 'all') {
    query.status = status;
  }

  const count = await Loan.countDocuments(query);
  const loans = await Loan.find(query)
    .populate('bookId', 'title author coverImage format')
    .sort({ issueDate: -1 })
    .limit(pageSize)
    .skip(pageSize * (pageNumber - 1));

  res.json({
    success: true,
    loans,
    page: pageNumber,
    pages: Math.ceil(count / pageSize),
    total: count
  });
});

// @desc    Renew a loan
// @route   POST /api/loans/:id/renew
// @access  Private
const renewLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id).populate('bookId');

  if (!loan) {
    res.status(404);
    throw new Error('Loan not found');
  }

  if (loan.userId.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized for this loan');
  }

  if (loan.status !== 'active') {
    res.status(400);
    throw new Error('Can only renew active loans');
  }

  if (loan.renewCount >= loan.maxRenewals) {
    res.status(400);
    throw new Error('Maximum renewal limit reached');
  }

  // Simulate queue check (we don't have reservations model in Phase 1 MVP, but leaving placeholder)
  const hasQueue = false; // in real impl, check if Reservation exists for bookId
  
  if (hasQueue) {
    res.status(400);
    throw new Error('Someone is waiting for this book');
  }

  // Extend due date by 14 days from current due date
  const newDueDate = new Date(loan.dueDate);
  newDueDate.setDate(newDueDate.getDate() + 14);

  loan.dueDate = newDueDate;
  loan.renewCount += 1;

  await loan.save();

  res.json({ success: true, loan });
});

module.exports = {
  getMyLoans,
  renewLoan,
};
