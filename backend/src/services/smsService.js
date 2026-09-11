const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Checks whether Twilio credentials and sender number are fully configured in the environment.
 * @returns {boolean}
 */
const isTwilioConfigured = () => {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  return Boolean(sid && token && from && sid.trim() && token.trim() && from.trim());
};

/**
 * Masks phone numbers for secure application logging.
 * E.g., +15551234567 -> +15***4567
 * @param {string} phone
 * @returns {string}
 */
const maskPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return '***';
  const trimmed = phone.trim();
  if (trimmed.length <= 5) return '***';
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-4)}`;
};

/**
 * Normalizes phone numbers to standard format.
 * @param {string} phone
 * @returns {string}
 */
const normalizePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    cleaned = `+1${cleaned}`; // Default to E.164 NANP if 10-digit number without country code
  }
  return cleaned;
};

/**
 * Dispatches student onboarding credentials via Twilio SMS REST API.
 * Never logs credentials, auth tokens, or passwords to stdout or telemetry.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient phone number
 * @param {string} options.studentId - Student ID
 * @param {string} options.tempPassword - Temporary password
 * @param {string} [options.name] - Student full name
 * @param {string} [options.collegeName] - Institution name
 * @param {string} [options.collegeSlug] - Institution portal slug
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, fallbackToHandout: boolean }>}
 */
const sendCredentialSMS = async ({
  to,
  studentId,
  tempPassword,
  name = 'Student',
  collegeName,
  collegeSlug,
}) => {
  if (!to) {
    return {
      success: false,
      error: 'Missing recipient phone number',
      fallbackToHandout: true,
    };
  }

  if (!isTwilioConfigured()) {
    return {
      success: false,
      reason: 'Twilio SMS is not configured in environment',
      fallbackToHandout: true,
    };
  }

  const sid = process.env.TWILIO_SID.trim();
  const token = process.env.TWILIO_AUTH_TOKEN.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER.trim();
  const recipientPhone = normalizePhoneNumber(to);
  const maskedPhone = maskPhoneNumber(recipientPhone);

  const portalLink = collegeSlug ? `/c/${collegeSlug}` : '/login';
  const instName = collegeName || 'BookBuddy';

  const bodyText = [
    `Hi ${name}, welcome to ${instName}! Your student library account has been provisioned.`,
    `Student ID: ${studentId}`,
    `Temp Password: ${tempPassword}`,
    `Login Portal: ${portalLink}`,
    `Note: You must set a permanent password upon first login.`,
  ].join(' ');

  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
    const basicAuth = Buffer.from(`${sid}:${token}`).toString('base64');

    const params = new URLSearchParams();
    params.append('To', recipientPhone);
    params.append('From', fromNumber);
    params.append('Body', bodyText);

    const response = await axios.post(endpoint, params.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });

    const messageId = response.data?.sid || `sms_${Date.now()}`;
    logger.info(`[SMS Service] Dispatched credential SMS to ${maskedPhone} (SID: ${messageId})`);

    return {
      success: true,
      messageId,
      fallbackToHandout: false,
    };
  } catch (err) {
    // Sanitize error to avoid leaking basic auth or account tokens
    const errMsg = err.response?.data?.message || err.message || 'SMS delivery failed';
    logger.warn(`[SMS Service] Twilio SMS dispatch failed for ${maskedPhone}: ${errMsg}`);

    return {
      success: false,
      error: errMsg,
      fallbackToHandout: true,
    };
  }
};

module.exports = {
  isTwilioConfigured,
  sendCredentialSMS,
  maskPhoneNumber,
  normalizePhoneNumber,
};
