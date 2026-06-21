const Notification = require('../models/Notification');
const { emitNotification } = require('../sockets');

const createNotification = async ({ userId, type, message, relatedBookId }) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      message,
      relatedBookId
    });

    // Emit socket event to the user's room
    emitNotification(userId, notification);

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

module.exports = {
  createNotification
};
