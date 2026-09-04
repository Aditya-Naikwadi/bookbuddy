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
};

module.exports = events;
