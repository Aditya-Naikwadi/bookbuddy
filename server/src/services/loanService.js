const Loan = require('../models/Loan');
const Book = require('../models/Book');
const User = require('../models/User');
const Reservation = require('../models/Reservation');
const AppError = require('../utils/AppError');
const { emitAvailabilityUpdate } = require('../sockets');
const { recordQualifyingAction } = require('./streakService');
const { calculateFine } = require('./fineService');
const { promoteNext } = require('./reservationService');

const borrowBook = async (userId, bookId) => {
  const book = await Book.findById(bookId);
  if (!book) {
    throw new AppError('Book not found', 404);
  }

  if (book.availableCopies <= 0) {
    throw new AppError('No copies available. Please join the queue.', 400);
  }

  // Check if user already has this book active
  const existingLoan = await Loan.findOne({ userId, bookId, status: 'active' });
  if (existingLoan) {
    throw new AppError('You have already borrowed this book', 400);
  }

  // Create Loan
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14); // 14 days default

  const loan = await Loan.create({
    userId,
    bookId,
    dueDate,
    status: 'active'
  });

  // Decrement copies
  book.availableCopies -= 1;
  if (book.availableCopies === 0) {
    book.availabilityStatus = 'checked_out';
  }
  await book.save();

  // Side effects
  emitAvailabilityUpdate(bookId, { availableCopies: book.availableCopies, status: book.availabilityStatus });
  await recordQualifyingAction(userId, 'borrow');

  return loan;
};

const renewLoan = async (loanId, userId) => {
  const loan = await Loan.findOne({ _id: loanId, userId });
  if (!loan) {
    throw new AppError('Loan not found', 404);
  }

  if (loan.status !== 'active') {
    throw new AppError('Can only renew active loans', 400);
  }

  const user = await User.findById(userId);

  // Check queue
  const queueCount = await Reservation.countDocuments({ bookId: loan.bookId, status: 'waiting' });
  if (queueCount > 0) {
    throw new AppError('Cannot renew this book because other users are waiting in the queue.', 400);
  }

  // Check renewals available
  const totalAllowed = loan.maxRenewals + (user.bonusRenewalsAvailable || 0);
  if (loan.renewCount >= totalAllowed) {
    throw new AppError('Maximum renewals reached', 400);
  }

  // Check if a bonus renewal is being consumed
  if (loan.renewCount >= loan.maxRenewals) {
    user.bonusRenewalsAvailable -= 1;
    await user.save();
  }

  // Renew
  const newDueDate = new Date(loan.dueDate);
  newDueDate.setDate(newDueDate.getDate() + 14); // add 14 days
  loan.dueDate = newDueDate;
  loan.renewCount += 1;
  await loan.save();

  // Side effects
  await recordQualifyingAction(userId, 'renew');

  return loan;
};

const returnLoan = async (loanId, userId) => {
  const loan = await Loan.findOne({ _id: loanId, userId });
  if (!loan) {
    throw new AppError('Loan not found', 404);
  }

  if (loan.status !== 'active') {
    throw new AppError('Loan is already returned', 400);
  }

  // Mark returned
  loan.status = 'returned';
  loan.returnDate = new Date();
  await loan.save();

  // Increment copies
  const book = await Book.findById(loan.bookId);
  if (book) {
    book.availableCopies += 1;
    book.availabilityStatus = 'available';
    await book.save();
    emitAvailabilityUpdate(book._id, { availableCopies: book.availableCopies, status: book.availabilityStatus });
  }

  // Side effects
  await calculateFine(loan);
  await promoteNext(loan.bookId);
  await recordQualifyingAction(userId, 'return');

  return loan;
};

module.exports = {
  borrowBook,
  renewLoan,
  returnLoan
};
