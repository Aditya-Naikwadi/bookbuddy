/**
 * Centralized Alert Dispatcher Module for BookBuddy
 *
 * Sends formatted alerts to Slack webhooks and logs alerts locally.
 * Supports categories: HEALTH_FAILURE, ERROR_SPIKE, AUTO_REMEDIATION_SUCCESS, AUTO_REMEDIATION_MANUAL_REVIEW
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

const sendSlackMessage = (payload) => {
  if (!SLACK_WEBHOOK_URL) {
    console.log('ℹ️ SLACK_WEBHOOK_URL not configured. Alert payload logged locally.');
    return Promise.resolve({ sent: false, reason: 'NO_WEBHOOK' });
  }

  return new Promise((resolve) => {
    try {
      const urlObj = new URL(SLACK_WEBHOOK_URL);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      const data = JSON.stringify(payload);

      const req = client.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        },
        (res) => {
          resolve({ sent: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode });
        }
      );

      req.on('error', (err) => {
        console.error('⚠️ Failed to dispatch Slack alert:', err.message);
        resolve({ sent: false, error: err.message });
      });

      req.write(data);
      req.end();
    } catch (err) {
      console.error('⚠️ Slack URL parse error:', err.message);
      resolve({ sent: false, error: err.message });
    }
  });
};

const dispatchAlert = async (type, details = {}) => {
  const timestamp = new Date().toISOString();
  let emoji = '🚨';
  let title = 'System Alert';
  let color = '#a30200'; // Default red

  switch (type) {
    case 'HEALTH_FAILURE':
      emoji = '🔥';
      title = 'CRITICAL DOWNTIME / HEALTH FAILURE DETECTED';
      color = '#ff0000';
      break;
    case 'ERROR_SPIKE':
      emoji = '⚡';
      title = 'RUNTIME ERROR SPIKE DETECTED';
      color = '#e67e22';
      break;
    case 'AUTO_REMEDIATION_SUCCESS':
      emoji = '✅';
      title = 'AUTO-REMEDIATION VERIFIED & MERGED';
      color = '#2eb886';
      break;
    case 'AUTO_REMEDIATION_PR':
      emoji = '🔧';
      title = 'AUTO-REMEDIATION PR OPENED FOR HUMAN REVIEW';
      color = '#3498db';
      break;
    case 'AUTO_REMEDIATION_MANUAL_REVIEW':
      emoji = '⚠️';
      title = 'AUTO-REMEDIATION FAILED / DISCARDED - MANUAL REVIEW REQUIRED';
      color = '#f1c40f';
      break;
  }

  console.log(`\n${emoji} ALERT DISPATCH [${type}]: ${details.summary || title}`);

  const fields = Object.keys(details).map((key) => ({
    title: key,
    value: typeof details[key] === 'object' ? JSON.stringify(details[key]) : String(details[key]),
    short: key.length < 20,
  }));

  const slackPayload = {
    text: `${emoji} *BookBuddy Automation Alert:* ${title}`,
    attachments: [
      {
        color,
        fields,
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  const result = await sendSlackMessage(slackPayload);

  // Write alert to persistent log
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const alertLogFile = path.join(logDir, 'alerts-audit.jsonl');
    fs.appendFileSync(
      alertLogFile,
      JSON.stringify({ timestamp, type, title, details, slackSent: result.sent }) + '\n',
      'utf8'
    );
  } catch (err) {
    console.error('⚠️ Could not write alert log:', err.message);
  }

  return result;
};

module.exports = { dispatchAlert, sendSlackMessage };

if (require.main === module) {
  const alertType = process.argv[2] || 'HEALTH_FAILURE';
  const summary = process.argv[3] || 'Manual Alert Test Execution';
  dispatchAlert(alertType, { summary, environment: process.env.NODE_ENV || 'production' });
}
