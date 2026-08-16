const nodemailer = require('nodemailer');
const logger = require('./logger');
const config = require('../config');

let transporter = null;

/**
 * Get or initialize nodemailer transporter
 */
const getTransporter = async () => {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST || config.smtpHost;
  const smtpPort = parseInt(process.env.SMTP_PORT || config.smtpPort || '587', 10);
  const smtpUser = process.env.SMTP_USER || config.smtpUser;
  const smtpPass = process.env.SMTP_PASS || config.smtpPass;

  if (smtpHost && smtpUser) {
    logger.info(`[Mailer] Initializing production SMTP transporter for ${smtpHost}:${smtpPort}`);
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  } else {
    logger.info('[Mailer] No production SMTP configured. Creating Ethereal test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info(`[Mailer] Ethereal test account created: ${testAccount.user}`);
    } catch (err) {
      logger.warn(
        `[Mailer] Ethereal test account creation failed (${err.message}). Using fallback jsonTransport.`
      );
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  return transporter;
};

/**
 * Async Non-Blocking Dispatch Queue
 */
const queueEmail = (mailOptions) => {
  if (process.env.NODE_ENV === 'test') {
    logger.info(`[Mailer Test Mock] Synchronous email stubbed for ${mailOptions.to}`);
    return Promise.resolve({ success: true, messageId: 'test-mock-id' });
  }
  setImmediate(async () => {
    try {
      const activeTransporter = await getTransporter();
      const info = await activeTransporter.sendMail({
        from:
          mailOptions.from ||
          process.env.SMTP_FROM ||
          '"BookBuddy Campus Hub" <notifications@bookbuddy.edu>',
        to: mailOptions.to,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info(
        `[Mailer Async] Email sent successfully to ${mailOptions.to} (MessageId: ${info.messageId})${
          previewUrl ? ` - Preview URL: ${previewUrl}` : ''
        }`
      );
      return { success: true, messageId: info.messageId, previewUrl };
    } catch (err) {
      logger.error(`[Mailer Async] Failed to deliver email to ${mailOptions.to}: ${err.message}`);
      return { success: false, error: err.message };
    }
  });
};

/**
 * Dispatch Overdue Fine Email Alert
 */
const sendOverdueFineEmail = async (userEmail, userName, bookTitle, fineAmount, dueDate) => {
  const subject = `⚠️ Overdue Book Notice: "${bookTitle}" - BookBuddy Library`;
  const text = `Hello ${userName},\n\nYour borrowed book "${bookTitle}" was due on ${new Date(dueDate).toLocaleDateString()}. An overdue fine of ₹${fineAmount} has been applied.\n\nPlease return the book to the library counter as soon as possible.\n\nBookBuddy Campus Library`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
      <h2 style="color: #dc2626;">⚠️ Overdue Book Notice</h2>
      <p>Hello <strong>${userName}</strong>,</p>
      <p>Your borrowed book <strong>"${bookTitle}"</strong> was due on <strong>${new Date(dueDate).toLocaleDateString()}</strong>.</p>
      <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0; border-radius: 4px;">
        <span style="font-weight: bold; color: #991b1b;">Overdue Fine Accrued: ₹${fineAmount}</span>
      </div>
      <p>Please return the physical copy to the library circulation desk to avoid additional charges.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #64748b;">BookBuddy Multi-Tenant Campus Hub</p>
    </div>
  `;

  queueEmail({ to: userEmail, subject, text, html });
};

/**
 * Dispatch Reservation Ready / Fulfilled Email Notification
 */
const sendReservationReadyEmail = async (userEmail, userName, bookTitle) => {
  const subject = `📚 Hold Reservation Ready for Pickup: "${bookTitle}"`;
  const text = `Hello ${userName},\n\nGood news! Your reserved book "${bookTitle}" is now available for pickup at the campus circulation desk.\n\nPlease pick up your copy within 48 hours.\n\nBookBuddy Campus Library`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
      <h2 style="color: #4f46e5;">📚 Reservation Ready for Pickup</h2>
      <p>Hello <strong>${userName}</strong>,</p>
      <p>Great news! The book you placed on hold, <strong>"${bookTitle}"</strong>, has been returned and is now reserved for you.</p>
      <div style="background-color: #e0e7ff; border-left: 4px solid #6366f1; padding: 12px; margin: 16px 0; border-radius: 4px;">
        <span style="font-weight: bold; color: #3730a3;">Available at Library Circulation Counter</span>
      </div>
      <p>Please collect your copy within 48 hours.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #64748b;">BookBuddy Multi-Tenant Campus Hub</p>
    </div>
  `;

  queueEmail({ to: userEmail, subject, text, html });
};

/**
 * Dispatch Password Reset / MFA Email Link
 */
const sendPasswordResetEmail = async (userEmail, userName, resetUrl) => {
  const subject = `🔐 Password Reset Request - BookBuddy`;
  const text = `Hello ${userName},\n\nYou requested a password reset for your BookBuddy account. Please click the link below to reset your password:\n\n${resetUrl}\n\nThis link is valid for 15 minutes. If you did not request this, please ignore this email.`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
      <h2 style="color: #0284c7;">🔐 Password Reset Request</h2>
      <p>Hello <strong>${userName}</strong>,</p>
      <p>We received a request to reset your password for your BookBuddy campus account.</p>
      <div style="margin: 20px 0;">
        <a href="${resetUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; inline-block;">Reset Password</a>
      </div>
      <p style="font-size: 12px; color: #64748b;">This link will expire in 15 minutes.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #64748b;">BookBuddy Security System</p>
    </div>
  `;

  queueEmail({ to: userEmail, subject, text, html });
};

module.exports = {
  getTransporter,
  queueEmail,
  sendOverdueFineEmail,
  sendReservationReadyEmail,
  sendPasswordResetEmail,
};
