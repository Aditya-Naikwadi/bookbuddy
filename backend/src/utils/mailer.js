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

  if (smtpPort === 25) {
    throw new Error(
      'Insecure SMTP port 25 is prohibited. Use port 587 (STARTTLS) or port 465 (TLS/SSL).'
    );
  }

  const connectionTimeout = parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS || '10000', 10);
  const greetingTimeout = parseInt(process.env.SMTP_GREETING_TIMEOUT_MS || '10000', 10);
  const socketTimeout = parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS || '15000', 10);

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
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
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
        connectionTimeout,
        greetingTimeout,
        socketTimeout,
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
 * Determines whether an SMTP or network error is transient and eligible for retry.
 */
const isTransientError = (err) => {
  if (!err) return false;
  const networkCodes = ['ETIMEDOUT', 'ECONNRESET', 'ESOCKET', 'EPIPE', 'ECONNREFUSED', 'EAI_AGAIN'];
  if (err.code && networkCodes.includes(err.code)) {
    return true;
  }
  if (err.responseCode && err.responseCode >= 400 && err.responseCode < 500) {
    return true;
  }
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('timeout') ||
    msg.includes('greeting never received') ||
    msg.includes('rate limit')
  ) {
    return true;
  }
  return false;
};

/**
 * Dispatches email with exponential backoff retry for transient failures.
 *
 * @param {Object} mailOptions
 * @param {number} [maxAttempts=3]
 * @param {number} [initialDelayMs=500]
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, attempts: number }>}
 */
const sendEmailWithRetry = async (mailOptions, maxAttempts = 3, initialDelayMs = 500) => {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt++;
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
        `[Mailer Async] Email sent successfully to ${mailOptions.to} (MessageId: ${info.messageId}, attempt: ${attempt})${
          previewUrl ? ` - Preview URL: ${previewUrl}` : ''
        }`
      );
      return { success: true, messageId: info.messageId, previewUrl, attempts: attempt };
    } catch (err) {
      lastError = err;
      const transient = isTransientError(err);
      logger.warn(
        `[Mailer Async] Delivery attempt ${attempt}/${maxAttempts} failed for ${mailOptions.to}: ${err.message} (transient: ${transient})`
      );

      if (!transient || attempt >= maxAttempts) {
        break;
      }

      // Exponential backoff with jitter
      const delay = initialDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  logger.error(
    `[Mailer Async] Permanent failure delivering email to ${mailOptions.to} after ${attempt} attempts: ${lastError?.message}`
  );
  return { success: false, error: lastError?.message || 'Unknown SMTP error', attempts: attempt };
};

/**
 * Async Non-Blocking Dispatch Queue (wraps sendEmailWithRetry in setImmediate)
 */
const queueEmail = (mailOptions) => {
  if (process.env.NODE_ENV === 'test' && !mailOptions.forceSendInTest) {
    logger.info(`[Mailer Test Mock] Synchronous email stubbed for ${mailOptions.to}`);
    return Promise.resolve({ success: true, messageId: 'test-mock-id', attempts: 1 });
  }

  setImmediate(async () => {
    try {
      await sendEmailWithRetry(mailOptions);
    } catch (err) {
      logger.error(`[Mailer Async Queue] Uncaught error in email dispatch: ${err.message}`);
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
  sendMail: queueEmail,
  sendEmailWithRetry,
  isTransientError,
  sendOverdueFineEmail,
  sendReservationReadyEmail,
  sendPasswordResetEmail,
};
