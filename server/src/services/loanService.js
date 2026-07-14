// Business logic service managing book checkout, return, and renewals.
const Loan = require('../models/Loan');
const Book = require('../models/Book');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const AppError = require('../utils/AppError');
const config = require('../config');
const streakService = require('./streakService');
const notificationService = require('./notificationService');
const reservationService = require('./reservationService');
const { runInTransaction } = require('../utils/transactionHelper');

const checkoutBook = async (userId, bookId, collegeId, issuedBy) => {
  return await runInTransaction(async (session) => {
    // 1. Check unpaid fines limit
    const unpaidFines = await Fine.find({ userId, status: 'unpaid' }).session(session);
    const totalUnpaidFine = unpaidFines.reduce((sum, f) => sum + f.amount, 0);
    if (totalUnpaidFine > config.unpaidFineLimit) {
      throw new AppError(
        `User has unpaid fines of ${totalUnpaidFine}, exceeding the limit of ${config.unpaidFineLimit}.`,
        400
      );
    }

    // 2. Check if user already has this book checked out active
    const existingLoan = await Loan.findOne({ userId, bookId, status: 'active' }).session(session);
    if (existingLoan) {
      throw new AppError('User already has an active loan for this book.', 400);
    }

    // 3. Check queue priority: if someone else is waiting at the front of the queue, reject
    const frontReservation = await Reservation.findOne({
      bookId,
      status: { $in: ['queued', 'ready_for_pickup'] },
    }).sort('queuePosition').session(session);

    if (frontReservation && frontReservation.userId.toString() !== userId.toString()) {
      throw new AppError('This book is reserved for another user next in the queue.', 400);
    }

    // 4. Atomic copiesAvailable decrement
    const book = await Book.findOneAndUpdate(
      { _id: bookId, collegeId, copiesAvailable: { $gt: 0 } },
      { $inc: { copiesAvailable: -1 } },
      { new: true, session }
    );
    if (!book) {
      throw new AppError('No copies available for this book.', 400);
    }

    try {
      // Fulfill reservation if this user was at the front
      if (frontReservation && frontReservation.userId.toString() === userId.toString()) {
        frontReservation.status = 'fulfilled';
        await frontReservation.save({ session });
      }

      // 5. Create active Loan record
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + config.loanPeriodDays);

      const [loan] = await Loan.create([{
        collegeId,
        userId,
        bookId,
        issueDate: new Date(),
        dueDate,
        maxRenewals: config.maxRenewals,
        status: 'active',
        issuedBy,
      }], { session });

      await streakService.recordQualifyingAction(userId, collegeId, 'checkout');

      return loan;
    } catch (err) {
      // Rollback the atomic decrement if loan creation failed
      await Book.updateOne({ _id: bookId }, { $inc: { copiesAvailable: 1 } }).session(session);
      throw err;
    }
  });
};

const returnBook = async (loanId, collegeId) => {
  // 1. Find active loan
  const loan = await Loan.findOne({ _id: loanId, collegeId, status: { $in: ['active', 'overdue'] } });
  if (!loan) {
    throw new AppError('Active loan not found.', 404);
  }

  // 2. Update loan status
  loan.status = 'returned';
  loan.returnDate = new Date();
  await loan.save();

  // 3. Increment copies atomically
  await Book.findOneAndUpdate({ _id: loan.bookId, collegeId }, { $inc: { copiesAvailable: 1 } });

  // 4. Promote next hold reservation in queue (reusable service call)
  await reservationService.promoteNextHold(loan.bookId, collegeId);

  await streakService.recordQualifyingAction(loan.userId, collegeId, 'return');

  return loan;
};

const renewLoan = async (loanId, userId) => {
  // 1. Find active loan
  const loan = await Loan.findOne({ _id: loanId, userId, status: 'active' });
  if (!loan) {
    throw new AppError('Active loan not found.', 404);
  }

  // 2. Check if max renewals reached
  if (loan.renewalCount >= loan.maxRenewals) {
    throw new AppError('Maximum renewals reached.', 400);
  }

  // 3. Check if others are waiting in queue
  const hasQueue = await Reservation.exists({
    bookId: loan.bookId,
    status: { $in: ['queued', 'ready_for_pickup'] },
  });
  if (hasQueue) {
    throw new AppError('Cannot renew. Other users are waiting in the queue.', 400);
  }

  // 4. Renew the loan
  const isOnTime = new Date() <= new Date(loan.dueDate);
  const newDueDate = new Date(loan.dueDate);
  newDueDate.setDate(newDueDate.getDate() + config.loanPeriodDays);
  loan.dueDate = newDueDate;
  loan.renewalCount += 1;
  await loan.save();

  if (isOnTime) {
    await streakService.recordQualifyingAction(userId, loan.collegeId, 'on_time_renewal');
  }

  return loan;
};

module.exports = {
  checkoutBook,
  returnBook,
  renewLoan,
};
