const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Standard Indian DLT (Distributed Ledger Technology) Template Registry
 * Pre-registered entity ID, sender header, and content template identifiers.
 */
const DLT_TEMPLATES = {
  CREDENTIALS_ONBOARDING: process.env.DLT_TEMPLATE_ONBOARDING || '1107160000000001',
  OVERDUE_ALERT: process.env.DLT_TEMPLATE_OVERDUE || '1107160000000002',
  RESERVATION_READY: process.env.DLT_TEMPLATE_RESERVATION || '1107160000000003',
  OTP_VERIFICATION: process.env.DLT_TEMPLATE_OTP || '1107160000000004',
};

const DEFAULT_DLT_ENTITY_ID = process.env.DLT_ENTITY_ID || '1101400000000000000';
const DEFAULT_DLT_HEADER = process.env.DLT_DEFAULT_SENDER_HEADER || 'BKBDDY';

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
 * Determines the active SMS provider ('twilio', 'msg91', 'gupshup', 'mock').
 */
const getActiveSMSProvider = () => {
  if (process.env.SMS_PROVIDER) {
    return process.env.SMS_PROVIDER.toLowerCase();
  }
  return isTwilioConfigured() ? 'twilio' : 'mock';
};

/**
 * Masks phone numbers for secure application logging and audit storage.
 * e.g., +15551234567 -> +15***4567, +919876543210 -> +91******3210
 *
 * @param {string} phone
 * @returns {string}
 */
const maskPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return '***';
  const trimmed = phone.trim();
  if (trimmed.length <= 5) return '***';
  if (trimmed.startsWith('+91') && trimmed.length >= 12) {
    return `+91******${trimmed.slice(-4)}`;
  }
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-4)}`;
};

/**
 * Normalizes phone numbers to standard E.164 format.
 * @param {string} phone
 * @returns {string}
 */
const normalizePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    // If 10-digit number without country code, default to NANP +1 unless configured
    cleaned = `+1${cleaned}`;
  }
  return cleaned;
};

/**
 * Helper to record per-row SMS delivery log.
 */
const recordDeliveryLog = async ({
  collegeId,
  recipientPhoneMasked,
  templateId,
  entityId,
  header,
  messageType,
  provider,
  providerMessageId,
  status,
  errorMessage,
}) => {
  try {
    const SMSDeliveryLog = require('../models/SMSDeliveryLog');
    return await SMSDeliveryLog.create({
      collegeId: collegeId || null,
      recipientPhoneMasked,
      templateId: templateId || null,
      entityId: entityId || DEFAULT_DLT_ENTITY_ID,
      header: header || DEFAULT_DLT_HEADER,
      messageType: messageType || 'onboarding',
      provider: provider || 'twilio',
      providerMessageId: providerMessageId || null,
      status: status || 'queued',
      errorMessage: errorMessage || null,
      dispatchedAt: new Date(),
    });
  } catch (err) {
    logger.warn(`[SMS Service] Failed to create SMSDeliveryLog: ${err.message}`);
    return null;
  }
};

/**
 * Dispatches student onboarding credentials via SMS with Indian DLT compliance and delivery logging.
 * Never logs credentials, auth tokens, or passwords to stdout or telemetry.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient phone number
 * @param {string} options.studentId - Student ID
 * @param {string} options.tempPassword - Temporary password
 * @param {string} [options.name] - Student full name
 * @param {string} [options.collegeId] - Institution ObjectId
 * @param {string} [options.collegeName] - Institution name
 * @param {string} [options.collegeSlug] - Institution portal slug
 * @param {string} [options.dltTemplateId] - Custom DLT Template ID
 * @param {string} [options.dltEntityId] - Custom DLT Entity ID (PEID)
 * @param {string} [options.dltHeader] - Custom Sender ID / Header
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, fallbackToHandout: boolean, deliveryLogId?: string }>}
 */
const sendCredentialSMS = async ({
  to,
  studentId,
  tempPassword,
  name = 'Student',
  collegeId,
  collegeName,
  collegeSlug,
  dltTemplateId = DLT_TEMPLATES.CREDENTIALS_ONBOARDING,
  dltEntityId = DEFAULT_DLT_ENTITY_ID,
  dltHeader = DEFAULT_DLT_HEADER,
}) => {
  if (!to) {
    return {
      success: false,
      error: 'Missing recipient phone number',
      fallbackToHandout: true,
    };
  }

  const activeProvider = getActiveSMSProvider();
  const recipientPhone = normalizePhoneNumber(to);
  const maskedPhone = maskPhoneNumber(recipientPhone);

  if (!isTwilioConfigured() && activeProvider !== 'mock') {
    await recordDeliveryLog({
      collegeId,
      recipientPhoneMasked: maskedPhone,
      templateId: dltTemplateId,
      entityId: dltEntityId,
      header: dltHeader,
      messageType: 'onboarding',
      provider: activeProvider,
      status: 'failed',
      errorMessage: 'Twilio SMS is not configured in environment',
    });

    return {
      success: false,
      reason: 'Twilio SMS is not configured in environment',
      fallbackToHandout: true,
    };
  }

  const portalLink = collegeSlug ? `/c/${collegeSlug}` : '/login';
  const instName = collegeName || 'BookBuddy';

  const bodyText = [
    `Hi ${name}, welcome to ${instName}! Your student library account has been provisioned.`,
    `Student ID: ${studentId}`,
    `Temp Password: ${tempPassword}`,
    `Login Portal: ${portalLink}`,
    `Note: You must set a permanent password upon first login.`,
  ].join(' ');

  // Handle Mock Provider in test or dry-run environment
  if (activeProvider === 'mock' || process.env.NODE_ENV === 'test') {
    if (!isTwilioConfigured()) {
      return {
        success: false,
        reason: 'Twilio SMS is not configured in environment',
        fallbackToHandout: true,
      };
    }
  }

  const sid = process.env.TWILIO_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();

  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
    const basicAuth = Buffer.from(`${sid}:${token}`).toString('base64');

    const params = new URLSearchParams();
    params.append('To', recipientPhone);
    params.append('From', fromNumber);
    params.append('Body', bodyText);

    // Pass Indian DLT regulatory parameters if available for Indian gateways
    if (dltEntityId) {
      params.append('DltEntityId', dltEntityId);
    }
    if (dltTemplateId) {
      params.append('DltTemplateId', dltTemplateId);
    }

    const response = await axios.post(endpoint, params.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });

    const messageId = response.data?.sid || `sms_${Date.now()}`;
    logger.info(
      `[SMS Service] Dispatched credential SMS to ${maskedPhone} (SID: ${messageId}, DLT PEID: ${dltEntityId}, Template: ${dltTemplateId})`
    );

    const log = await recordDeliveryLog({
      collegeId,
      recipientPhoneMasked: maskedPhone,
      templateId: dltTemplateId,
      entityId: dltEntityId,
      header: dltHeader,
      messageType: 'onboarding',
      provider: activeProvider,
      providerMessageId: messageId,
      status: 'sent',
    });

    return {
      success: true,
      messageId,
      deliveryLogId: log?._id?.toString(),
      fallbackToHandout: false,
    };
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message || 'SMS delivery failed';
    logger.warn(`[SMS Service] Twilio SMS dispatch failed for ${maskedPhone}: ${errMsg}`);

    const log = await recordDeliveryLog({
      collegeId,
      recipientPhoneMasked: maskedPhone,
      templateId: dltTemplateId,
      entityId: dltEntityId,
      header: dltHeader,
      messageType: 'onboarding',
      provider: activeProvider,
      status: 'failed',
      errorMessage: errMsg,
    });

    return {
      success: false,
      error: errMsg,
      deliveryLogId: log?._id?.toString(),
      fallbackToHandout: true,
    };
  }
};

/**
 * Generic SMS Dispatcher with DLT Parameter Support across message types.
 */
const dispatchSMS = async ({
  to,
  message,
  messageType = 'general',
  templateId,
  entityId = DEFAULT_DLT_ENTITY_ID,
  header = DEFAULT_DLT_HEADER,
  collegeId,
}) => {
  if (!to || !message) {
    return { success: false, error: 'Recipient phone and message body are required' };
  }

  const recipientPhone = normalizePhoneNumber(to);
  const maskedPhone = maskPhoneNumber(recipientPhone);
  const activeProvider = getActiveSMSProvider();

  if (!isTwilioConfigured()) {
    await recordDeliveryLog({
      collegeId,
      recipientPhoneMasked: maskedPhone,
      templateId,
      entityId,
      header,
      messageType,
      provider: activeProvider,
      status: 'failed',
      errorMessage: 'SMS provider not configured in environment',
    });

    return { success: false, error: 'SMS provider not configured' };
  }

  const sid = process.env.TWILIO_SID.trim();
  const token = process.env.TWILIO_AUTH_TOKEN.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER.trim();

  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
    const basicAuth = Buffer.from(`${sid}:${token}`).toString('base64');

    const params = new URLSearchParams();
    params.append('To', recipientPhone);
    params.append('From', fromNumber);
    params.append('Body', message);

    if (entityId) params.append('DltEntityId', entityId);
    if (templateId) params.append('DltTemplateId', templateId);

    const response = await axios.post(endpoint, params.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });

    const messageId = response.data?.sid || `sms_${Date.now()}`;
    const log = await recordDeliveryLog({
      collegeId,
      recipientPhoneMasked: maskedPhone,
      templateId,
      entityId,
      header,
      messageType,
      provider: activeProvider,
      providerMessageId: messageId,
      status: 'sent',
    });

    return { success: true, messageId, deliveryLogId: log?._id?.toString() };
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message || 'SMS delivery failed';
    const log = await recordDeliveryLog({
      collegeId,
      recipientPhoneMasked: maskedPhone,
      templateId,
      entityId,
      header,
      messageType,
      provider: activeProvider,
      status: 'failed',
      errorMessage: errMsg,
    });

    return { success: false, error: errMsg, deliveryLogId: log?._id?.toString() };
  }
};

module.exports = {
  isTwilioConfigured,
  sendCredentialSMS,
  dispatchSMS,
  maskPhoneNumber,
  normalizePhoneNumber,
  recordDeliveryLog,
  DLT_TEMPLATES,
  DEFAULT_DLT_ENTITY_ID,
  DEFAULT_DLT_HEADER,
};
