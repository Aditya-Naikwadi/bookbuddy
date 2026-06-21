const Reservation = require('../models/Reservation');
const Book = require('../models/Book');
const AppError = require('../utils/AppError');
const { createNotification } = require('./notificationService');

const joinQueue = async (userId, bookId) => {
  const book = await Book.findById(bookId);
  if (!book) {
    throw new AppError('Book not found', 404);
  }

  // Only allowed when availableCopies === 0
  if (book.availableCopies > 0) {
    throw new AppError('Book is currently available. You can borrow it directly.', 400);
  }

  // Check if user is already in queue
  const existingRes = await Reservation.findOne({ userId, bookId, status: { $in: ['waiting', 'ready'] } });
  if (existingRes) {
    throw new AppError('You are already in the queue for this book', 400);
  }

  const currentCount = await Reservation.countDocuments({ bookId, status: 'waiting' });

  const reservation = await Reservation.create({
    userId,
    bookId,
    queuePosition: currentCount + 1,
    status: 'waiting'
  });

  return reservation;
};

const leaveQueue = async (reservationId, userId) => {
  const reservation = await Reservation.findOne({ _id: reservationId, userId });
  if (!reservation) {
    throw new AppError('Reservation not found', 404);
  }

  if (reservation.status !== 'waiting' && reservation.status !== 'ready') {
    throw new AppError('Cannot leave a queue that is already cancelled or expired', 400);
  }

  const { bookId, queuePosition } = reservation;

  reservation.status = 'cancelled';
  reservation.queuePosition = null;
  await reservation.save();

  // Decrement everyone behind
  if (queuePosition !== null) {
    await Reservation.updateMany(
      { bookId, status: 'waiting', queuePosition: { $gt: queuePosition } },
      { $inc: { queuePosition: -1 } }
    );
  }

  return reservation;
};

const promoteNext = async (bookId) => {
  // Move the lowest queuePosition waiting reservation to ready
  const nextRes = await Reservation.findOne({ bookId, status: 'waiting' }).sort({ queuePosition: 1 });
  
  if (nextRes) {
    const { queuePosition } = nextRes;

    nextRes.status = 'ready';
    nextRes.notifiedAt = new Date();
    nextRes.queuePosition = null;
    await nextRes.save();

    // Decrement everyone behind by 1
    await Reservation.updateMany(
      { bookId, status: 'waiting', queuePosition: { $gt: queuePosition } },
      { $inc: { queuePosition: -1 } }
    );

    // Notify the user
    await createNotification({
      userId: nextRes.userId,
      type: 'reservation_ready',
      message: `A book you reserved is now ready to be picked up!`,
      relatedBookId: bookId
    });

    return nextRes;
  }
  return null;
};

module.exports = {
  joinQueue,
  leaveQueue,
  promoteNext
};
