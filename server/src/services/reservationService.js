// Business logic service managing book reservations and queues.
const Reservation = require('../models/Reservation');
const Book = require('../models/Book');
const AppError = require('../utils/AppError');

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
  const nextHold = await Reservation.findOne({
    bookId,
    status: 'queued',
    collegeId,
  }).sort('queuePosition');

  if (nextHold) {
    nextHold.status = 'ready_for_pickup';
    nextHold.readyAt = new Date();
    await nextHold.save();

    const notificationService = require('./notificationService');
    await notificationService.notify(
      nextHold.userId,
      'hold_ready',
      'Your held book is ready for pickup.',
      nextHold.bookId,
      'Book'
    );
    return nextHold;
  }
  return null;
};

const joinQueue = async (userId, bookId, collegeId) => {
  return await placeHold(userId, bookId, collegeId);
};

const leaveQueue = async (reservationId, userId) => {
  const reservation = await Reservation.findOne({ _id: reservationId, userId });
  if (!reservation) {
    throw new AppError('Reservation not found.', 404);
  }
  if (reservation.status !== 'queued' && reservation.status !== 'ready_for_pickup') {
    throw new AppError('Only active reservations can be cancelled.', 400);
  }
  reservation.status = 'cancelled';
  await reservation.save();
  return reservation;
};

module.exports = {
  placeHold,
  getQueuePosition,
  promoteNextHold,
  joinQueue,
  leaveQueue,
};
