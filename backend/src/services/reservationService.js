// Business logic service managing book reservations and queues.
const Reservation = require('../models/Reservation');
const Book = require('../models/Book');
const AppError = require('../utils/AppError');
const { atomicConditionalUpdate } = require('../utils/atomicUpdateHelper');

const placeHold = async (userId, bookId, collegeId) => {
  const book = await Book.findOne({ _id: bookId, collegeId });
  if (!book) {
    throw new AppError('Book not found.', 404);
  }

  // Only allow reservations/holds if the book is fully checked out
  if (book.copiesAvailable > 0) {
    throw new AppError('Book is currently available. Please borrow it directly.', 400);
  }

  // Reject duplicate active holds
  const existingHold = await Reservation.findOne({
    userId,
    bookId,
    status: { $in: ['queued', 'ready_for_pickup'] },
    collegeId,
  });

  if (existingHold) {
    throw new AppError('You already have an active hold on this book.', 400);
  }

  // Compute new queue position and save with collision safety
  let reservation;
  let retries = 5;
  while (retries > 0) {
    try {
      const currentQueuedCount = await Reservation.countDocuments({
        bookId,
        status: { $in: ['queued', 'ready_for_pickup'] },
        collegeId,
      });

      reservation = await Reservation.create({
        collegeId,
        userId,
        bookId,
        queuePosition: currentQueuedCount + 1,
        status: 'queued',
      });
      break;
    } catch (err) {
      if (err.code === 11000) {
        retries--;
        if (retries === 0) {
          throw new AppError('Server is busy placing reservations, please try again.', 409);
        }
        // Brief exponential backoff/jitter before retrying
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 10));
      } else {
        throw err;
      }
    }
  }

  const updatedBook = await Book.findOneAndUpdate(
    { _id: bookId, collegeId },
    { $inc: { reservedCopies: 1 } },
    { returnDocument: 'after' }
  );

  try {
    const { emitRealtimeEvent, events } = require('../sockets');
    const rooms = [
      collegeId ? `college:${collegeId}` : null,
      updatedBook?.isShareableAcrossColleges ? 'cross-college:public' : null,
    ].filter(Boolean);

    emitRealtimeEvent({
      event: events.BOOK_UPDATED,
      rooms,
      entityId: bookId,
      collegeId,
      changed: {
        copiesAvailable: updatedBook ? updatedBook.copiesAvailable : 0,
        reservedCopies: updatedBook ? updatedBook.reservedCopies : 1,
        copiesTotal: updatedBook ? updatedBook.copiesTotal : 0,
      },
    });
  } catch (_err) {
    // Non-blocking socket emit
  }

  return reservation;
};

const getQueuePosition = async (userId, bookId) => {
  const hold = await Reservation.findOne({
    userId,
    bookId,
    status: { $in: ['queued', 'ready_for_pickup'] },
  });

  if (!hold) {
    return null;
  }

  return hold.queuePosition;
};

const promoteNextHold = async (bookId, collegeId) => {
  const config = require('../config');
  const holdPickupWindowHours = config.holdPickupWindowHours || 48;
  const expiresAt = new Date(Date.now() + holdPickupWindowHours * 60 * 60 * 1000);

  const nextHold = await Reservation.findOneAndUpdate(
    {
      bookId,
      status: 'queued',
      collegeId,
    },
    {
      $set: {
        status: 'ready_for_pickup',
        readyAt: new Date(),
        expiresAt,
      },
    },
    {
      sort: { queuePosition: 1 },
      returnDocument: 'after',
    }
  );

  if (nextHold) {
    const notificationService = require('./notificationService');
    await notificationService.notify(
      nextHold.userId,
      'hold_ready',
      'Your held book is ready for pickup.',
      nextHold.bookId,
      'Book'
    );

    try {
      const { emitRealtimeEvent, events } = require('../sockets');
      emitRealtimeEvent({
        event: events.RESERVATION_READY,
        rooms: [`user:${nextHold.userId}`, collegeId ? `role:${collegeId}:librarian` : null].filter(
          Boolean
        ),
        entityId: nextHold._id,
        collegeId,
        changed: {
          status: 'ready_for_pickup',
          bookId: nextHold.bookId,
          expiresAt: nextHold.expiresAt,
        },
        payload: {
          reservationId: nextHold._id,
          bookId: nextHold.bookId,
          userId: nextHold.userId,
          expiresAt: nextHold.expiresAt,
        },
      });

      const book = await Book.findById(bookId);
      const rooms = [
        collegeId ? `college:${collegeId}` : null,
        book?.isShareableAcrossColleges ? 'cross-college:public' : null,
      ].filter(Boolean);

      emitRealtimeEvent({
        event: events.BOOK_UPDATED,
        rooms,
        entityId: bookId,
        collegeId,
        changed: {
          copiesAvailable: book ? book.copiesAvailable : 0,
          reservedCopies: book?.reservedCopies || 0,
          copiesTotal: book?.copiesTotal || 0,
        },
      });
    } catch (_err) {
      // Non-blocking socket emit
    }

    return nextHold;
  }
  return null;
};

const joinQueue = async (userId, bookId, collegeId) => {
  return await placeHold(userId, bookId, collegeId);
};

const leaveQueue = async (reservationId, userId) => {
  const {
    matched,
    doc: reservation,
    reason,
  } = await atomicConditionalUpdate(
    Reservation,
    {
      _id: reservationId,
      userId,
      status: { $in: ['queued', 'ready_for_pickup'] },
    },
    null,
    {
      $set: { status: 'cancelled' },
    },
    { checkExistenceOnFailure: true }
  );

  if (!matched) {
    if (reason === 'NOT_FOUND') {
      throw new AppError('Reservation not found.', 404);
    }
    throw new AppError('Only active reservations can be cancelled.', 400);
  }

  if (reservation) {
    try {
      const updatedBook = await Book.findOneAndUpdate(
        { _id: reservation.bookId },
        { $inc: { reservedCopies: -1 } },
        { returnDocument: 'after' }
      );
      if (updatedBook && updatedBook.reservedCopies < 0) {
        await Book.updateOne({ _id: updatedBook._id }, { $set: { reservedCopies: 0 } });
        updatedBook.reservedCopies = 0;
      }

      const { emitRealtimeEvent, events } = require('../sockets');
      const rooms = [
        reservation.collegeId ? `college:${reservation.collegeId}` : null,
        updatedBook?.isShareableAcrossColleges ? 'cross-college:public' : null,
      ].filter(Boolean);

      emitRealtimeEvent({
        event: events.BOOK_UPDATED,
        rooms,
        entityId: reservation.bookId,
        collegeId: reservation.collegeId,
        changed: {
          copiesAvailable: updatedBook ? updatedBook.copiesAvailable : 0,
          reservedCopies: updatedBook ? updatedBook.reservedCopies : 0,
          copiesTotal: updatedBook ? updatedBook.copiesTotal : 0,
        },
      });
    } catch (_err) {
      // Non-blocking socket emit
    }
  }

  return reservation;
};

module.exports = {
  placeHold,
  getQueuePosition,
  promoteNextHold,
  joinQueue,
  leaveQueue,
};
