// Business logic service managing physical book loans, checkouts, returns, and renewals.
const Loan = require('../models/Loan');
const Book = require('../models/Book');
const Fine = require('../models/Fine');
const Reservation = require('../models/Reservation');
const config = require('../config');
const AppError = require('../utils/AppError');
const streakService = require('./streakService');
const badgeService = require('./badgeService');
const logger = require('../utils/logger');
const { runInTransaction } = require('../utils/transactionHelper');
const { atomicConditionalUpdate } = require('../utils/atomicUpdateHelper');

const checkoutBook = async (userId, bookId, collegeId, issuedBy) => {
  const txResult = await runInTransaction(
    async (session) => {
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
      const existingLoan = await Loan.findOne({ userId, bookId, status: 'active' }).session(
        session
      );
      if (existingLoan) {
        throw new AppError('User already has an active loan for this book.', 400);
      }

      // 3. Check queue priority: if someone else is waiting at the front of the queue, reject
      const frontReservation = await Reservation.findOne({
        bookId,
        status: { $in: ['queued', 'ready_for_pickup'] },
      })
        .sort('queuePosition')
        .session(session);

      if (frontReservation && frontReservation.userId.toString() !== userId.toString()) {
        throw new AppError('This book is reserved for another user next in the queue.', 400);
      }

      // 4. Atomic copiesAvailable decrement
      const book = await Book.findOneAndUpdate(
        { _id: bookId, collegeId, copiesAvailable: { $gt: 0 } },
        { $inc: { copiesAvailable: -1 } },
        { returnDocument: 'after', session }
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

        const [loan] = await Loan.create(
          [
            {
              collegeId,
              userId,
              bookId,
              issueDate: new Date(),
              dueDate,
              maxRenewals: config.maxRenewals,
              status: 'active',
              issuedBy,
            },
          ],
          { session }
        );

        return { loan, book };
      } catch (err) {
        // Rollback the atomic decrement if loan creation failed
        await Book.updateOne({ _id: bookId }, { $inc: { copiesAvailable: 1 } }).session(session);
        throw err;
      }
    },
    async (result) => {
      if (!result || !result.loan) return;
      const { loan, book } = result;

      // Post-transaction side-effects execute strictly after successful commit
      try {
        await streakService.recordQualifyingAction(userId, collegeId, 'checkout');
      } catch (err) {
        logger.error(
          `Error recording qualifying streak action after book checkout: ${err.message}`
        );
      }

      badgeService
        .evaluateBadges(userId, 'book_borrowed', { bookId, loanId: loan._id })
        .catch((err) =>
          logger.error(`Error evaluating badges after book checkout: ${err.message}`)
        );

      try {
        const socketModule = require('../sockets');
        const io =
          socketModule && typeof socketModule.getIo === 'function' ? socketModule.getIo() : null;
        if (io && collegeId) {
          io.to(`college:${collegeId}`).emit('book:availability_updated', {
            bookId,
            availableCopies: book ? book.copiesAvailable : undefined,
          });
        }
      } catch (_err) {
        // Non-blocking socket emit
      }
    }
  );

  return txResult?.loan || txResult;
};

const returnBook = async (loanId, collegeId) => {
  const txResult = await runInTransaction(
    async (session) => {
      // 1. Find active loan within session
      const loan = await Loan.findOne({
        _id: loanId,
        collegeId,
        status: { $in: ['active', 'overdue'] },
      }).session(session);
      if (!loan) {
        throw new AppError('Active loan not found.', 404);
      }

      // 2. Update loan status
      loan.status = 'returned';
      loan.returnDate = new Date();
      await loan.save({ session });

      // Calculate fine in real-time if returned overdue
      if (loan.dueDate && loan.returnDate > loan.dueDate) {
        try {
          const fineService = require('./fineService');
          await fineService.calculateFine(loan);
        } catch (_fineErr) {
          // Fine calculation errors non-blocking
        }
      }

      // 3. Increment copies atomically, ensuring it does not exceed total copies
      const { doc: updatedBook } = await atomicConditionalUpdate(
        Book,
        { _id: loan.bookId, collegeId },
        { $lt: ['$copiesAvailable', '$copiesTotal'] },
        { $inc: { copiesAvailable: 1 } },
        { session }
      );
      const book =
        updatedBook || (await Book.findOne({ _id: loan.bookId, collegeId }).session(session));

      // 4. Promote next hold reservation in database within session
      const nextHold = await Reservation.findOneAndUpdate(
        {
          bookId: loan.bookId,
          status: 'queued',
          collegeId,
        },
        {
          $set: {
            status: 'ready_for_pickup',
            readyAt: new Date(),
          },
        },
        {
          sort: { queuePosition: 1 },
          returnDocument: 'after',
          session,
        }
      );

      return { loan, book, nextHold };
    },
    async (result) => {
      if (!result || !result.loan) return;
      const { loan, book, nextHold } = result;

      // 1. Evaluate return badges
      badgeService
        .evaluateBadges(loan.userId, 'book_returned', { loanId: loan._id, bookId: loan.bookId })
        .catch((err) => logger.error(`Error evaluating badges after book return: ${err.message}`));

      const { sendNotificationWithEmailFallback } = require('./emailService');
      const bookTitle = book ? book.title : 'Catalog Item';

      // 2. Borrower return confirmation notification & email
      await sendNotificationWithEmailFallback(
        loan.userId,
        'book_returned',
        `Your borrowed book "${bookTitle}" was successfully returned to the library.`,
        {
          relatedId: loan.bookId,
          relatedType: 'Book',
          subject: `📚 Book Return Confirmation: "${bookTitle}"`,
        }
      ).catch((err) => {
        logger.error(`Error sending return confirmation email to borrower: ${err.message}`);
      });

      // 3. Realtime socket event
      try {
        const socketModule = require('../sockets');
        const io =
          socketModule && typeof socketModule.getIo === 'function' ? socketModule.getIo() : null;
        if (io && collegeId) {
          io.to(`college:${collegeId}`).emit('book:availability_updated', {
            bookId: loan.bookId,
            availableCopies: book ? book.copiesAvailable : undefined,
          });
        }
      } catch (_err) {
        // Non-blocking socket emit
      }

      // 4. Promoted hold patron notification
      if (nextHold) {
        try {
          const notificationService = require('./notificationService');
          await notificationService.notify(
            nextHold.userId,
            'hold_ready',
            'Your held book is ready for pickup.',
            nextHold.bookId,
            'Book'
          );
        } catch (holdNotifyErr) {
          logger.error(`Error notifying promoted hold patron: ${holdNotifyErr.message}`);
        }
      }

      // 5. Watchers notification loop
      try {
        const WatchRequest = require('../models/WatchRequest');
        const watchers = await WatchRequest.find({ bookId: loan.bookId });
        for (const watcher of watchers) {
          await sendNotificationWithEmailFallback(
            watcher.userId,
            'book_available',
            `Good news! The book "${bookTitle}" you were watching is now available in the library.`,
            {
              relatedId: loan.bookId,
              relatedType: 'Book',
              subject: `🔔 Book Available: "${bookTitle}"`,
            }
          ).catch((err) => {
            logger.error(`Error notifying watcher: ${err.message}`);
          });
        }
      } catch (watchErr) {
        logger.error(`Error dispatching watcher notifications after return: ${watchErr.message}`);
      }
    }
  );

  return txResult?.loan || txResult;
};

const renewLoan = async (loanId, userId, collegeId) => {
  const txResult = await runInTransaction(
    async (session) => {
      // 1. Find active or overdue loan in tenant scope
      const loan = await Loan.findOne({
        _id: loanId,
        userId,
        collegeId,
        status: { $in: ['active', 'overdue'] },
      }).session(session);

      if (!loan) {
        throw new AppError('Active loan not found.', 404);
      }

      // 2. Unpaid fine limit check
      const unpaidFines = await Fine.find({ userId, status: 'unpaid' }).session(session);
      const totalUnpaidFine = unpaidFines.reduce((sum, f) => sum + f.amount, 0);
      const maxFineLimit = config.unpaidFineLimit || 100;
      if (totalUnpaidFine > maxFineLimit) {
        const err = new AppError(
          `Cannot renew. Unpaid fines of ₹${totalUnpaidFine.toFixed(2)} exceed the limit of ₹${maxFineLimit}.`,
          400
        );
        err.code = 'UNPAID_FINES_EXCEEDED';
        throw err;
      }

      // 3. Limit check
      if (loan.renewalCount >= loan.maxRenewals) {
        const err = new AppError('Maximum renewals reached.', 400);
        err.code = 'RENEWAL_LIMIT_REACHED';
        err.meta = { limit: loan.maxRenewals, current: loan.renewalCount };
        throw err;
      }

      // 3. Check queue holds from other students
      const pendingHold = await Reservation.findOne({
        bookId: loan.bookId,
        status: { $in: ['queued', 'ready_for_pickup'] },
        userId: { $ne: userId },
      }).session(session);

      if (pendingHold) {
        const err = new AppError('Cannot renew. Other users are waiting in the queue.', 400);
        err.code = 'HOLD_PENDING';
        throw err;
      }

      // 4. Overdue cutoff check (max 7 days overdue)
      if (loan.status === 'overdue') {
        const overdueMs = Date.now() - new Date(loan.dueDate).getTime();
        const overdueDays = Math.max(0, Math.floor(overdueMs / (1000 * 60 * 60 * 24)));
        if (overdueDays > 7) {
          const err = new AppError(
            'Loan is overdue past the 7 days renewal eligibility cutoff.',
            400
          );
          err.code = 'OVERDUE_PAST_CUTOFF';
          err.meta = { maxDays: 7, currentDays: overdueDays };
          throw err;
        }
      }

      // 5. Extend due date and increment renewalCount atomically
      const isOnTime = new Date() <= new Date(loan.dueDate);
      const newDueDate = new Date(loan.dueDate);
      newDueDate.setDate(newDueDate.getDate() + config.loanPeriodDays);

      const { matched, doc: updatedLoan } = await atomicConditionalUpdate(
        Loan,
        { _id: loanId, userId, collegeId },
        { $lt: ['$renewalCount', '$maxRenewals'] },
        {
          $inc: { renewalCount: 1 },
          $set: { dueDate: newDueDate, status: 'active' },
        },
        { session }
      );

      if (!matched || !updatedLoan) {
        const err = new AppError('Maximum renewals reached.', 400);
        err.code = 'RENEWAL_LIMIT_REACHED';
        err.meta = { limit: loan.maxRenewals, current: loan.renewalCount };
        throw err;
      }

      return { loan: updatedLoan, isOnTime };
    },
    async (result) => {
      if (!result || !result.loan) return;
      const { loan, isOnTime } = result;
      if (isOnTime) {
        try {
          await streakService.recordQualifyingAction(userId, loan.collegeId, 'on_time_renewal');
        } catch (streakErr) {
          logger.error(`Error recording renewal streak action: ${streakErr.message}`);
        }
      }
    }
  );

  return txResult?.loan || txResult;
};

module.exports = {
  checkoutBook,
  returnBook,
  renewLoan,
};
