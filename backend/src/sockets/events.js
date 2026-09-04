/**
 * Shared Socket.io event names and description of payloads.
 */
const events = {
  /**
   * Emitted to user's room when their daily streak changes.
   * Payload: { currentStreak: Number, maxStreak: Number, freezesAvailable: Number }
   */
  STREAK_UPDATED: 'streak:updated',

  /**
   * Emitted to user's room when a new notification is generated.
   * Payload: { _id: String, type: String, message: String, read: Boolean, createdAt: String }
   */
  NOTIFICATION_NEW: 'notification:new',

  /**
   * Emitted to college room when a book is checked out.
   * Payload: { bookId: String, loanId: String, copiesAvailable: Number }
   */
  LOAN_CHECKOUT: 'loan:checkout',

  /**
   * Emitted to college room when a book is returned.
   * Payload: { bookId: String, loanId: String, copiesAvailable: Number }
   */
  LOAN_RETURN: 'loan:return',

  /**
   * Emitted to college room when a reservation is created.
   * Payload: { bookId: String, reservationId: String, queuePosition: Number }
   */
  RESERVATION_CREATED: 'reservation:created',

  /**
   * Emitted to user's room when their reservation is ready for pickup.
   * Payload: { bookId: String, reservationId: String, bookTitle: String }
   */
  RESERVATION_READY: 'reservation:ready',

  /**
   * Emitted to college room when an acquisition order status changes.
   * Payload: { orderId: String, status: String, vendorName: String }
   */
  ACQUISITION_UPDATED: 'acquisition:updated',
};

module.exports = events;
