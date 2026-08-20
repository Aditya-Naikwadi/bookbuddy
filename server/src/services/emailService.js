const mailer = require('../utils/mailer');
const notificationService = require('./notificationService');
const { isUserConnected } = require('../sockets');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Send notification payload via Socket.io if online, or fallback to Nodemailer email if offline
 */
const sendNotificationWithEmailFallback = async (userId, type, message, extraPayload = {}) => {
  const user = await User.findById(userId).select('email name');
  const userEmail = user?.email;
  const userName = user?.name || 'Patron';

  let online = false;
  try {
    online = isUserConnected(userId);
  } catch {
    online = false;
  }

  // Record/Emit notification via notificationService
  const notification = await notificationService.notify(
    userId,
    type,
    message,
    extraPayload.relatedId,
    extraPayload.relatedType
  );

  let emailSent = false;
  // Trigger email via nodemailer when user has no active socket connection at the moment of event
  if (!online && userEmail) {
    logger.info(
      `[Email Service Fallback] User ${userId} is offline. Sending email fallback via Nodemailer for event: ${type}`
    );
    await mailer.queueEmail({
      to: userEmail,
      subject: extraPayload.subject || `[BookBuddy Alert] ${type.replace(/_/g, ' ').toUpperCase()}`,
      text: `Hello ${userName},\n\n${message}\n\nBookBuddy Campus Library`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
          <h2 style="color: #4f46e5;">📚 BookBuddy Library Notification</h2>
          <p>Hello <strong>${userName}</strong>,</p>
          <p>${message}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">BookBuddy Multi-Tenant Campus Hub</p>
        </div>
      `,
    });
    emailSent = true;
  }

  return { notification, online, emailSent };
};

module.exports = {
  sendNotificationWithEmailFallback,
  sendEmail: notificationService.sendEmail,
  mailer,
};
