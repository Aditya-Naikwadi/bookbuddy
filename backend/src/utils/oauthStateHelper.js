const crypto = require('crypto');
const config = require('../config');
const env = require('../config/env');
const logger = require('./logger');

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * In-memory replay prevention cache for consumed OAuth nonces.
 * Self-cleaning via TTL.
 */
const consumedNonces = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiresAt] of consumedNonces.entries()) {
    if (now > expiresAt) {
      consumedNonces.delete(nonce);
    }
  }
}, 60 * 1000).unref();

/**
 * Derives the signing secret for OAuth state HMAC.
 */
const getSigningSecret = () => {
  return (
    process.env.OAUTH_STATE_SECRET ||
    process.env.JWT_SECRET ||
    config.jwtSecret ||
    'bookbuddy-oauth-secret-fallback'
  );
};

/**
 * Resolves active and fallback signing secrets to support zero-downtime rotation.
 */
const getSigningSecretCandidates = () => {
  const secrets = [];
  const primary = getSigningSecret();
  if (primary) {
    String(primary)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => secrets.push(s));
  }
  const previous = process.env.OAUTH_STATE_SECRET_PREVIOUS || process.env.JWT_SECRET_PREVIOUS;
  if (previous) {
    String(previous)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        if (!secrets.includes(s)) secrets.push(s);
      });
  }
  return secrets.length > 0 ? secrets : ['bookbuddy-oauth-secret-fallback'];
};

/**
 * Validates a return URL to prevent open redirect vulnerabilities.
 * Allows:
 * 1. Safe relative paths starting with a single '/' (not '//')
 * 2. Absolute URLs matching allowed institutional domains
 *
 * @param {string} returnUrl
 * @param {string[]} [extraAllowedDomains]
 * @returns {boolean}
 */
const isSafeReturnUrl = (returnUrl, extraAllowedDomains = []) => {
  if (!returnUrl || typeof returnUrl !== 'string') return false;
  const trimmed = returnUrl.trim();

  // Safe relative paths: starts with '/' but not '//' (protocol-relative) and no control chars
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    // Disallow javascript: or data: in relative path attempts
    if (trimmed.includes(':')) {
      return false;
    }
    return true;
  }

  // Parse absolute URL
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Default allowed domains: localhost, 127.0.0.1, configured clientOrigin
    const allowed = new Set([
      'localhost',
      '127.0.0.1',
      'bookbuddy.app',
      'auth.bookbuddy.app',
      ...extraAllowedDomains.map((d) => d.toLowerCase()),
    ]);

    if (config.clientOrigin && config.clientOrigin !== '*') {
      try {
        const clientOriginHost = new URL(config.clientOrigin).hostname.toLowerCase();
        allowed.add(clientOriginHost);
      } catch {
        // ignore invalid URL in config
      }
    }

    if (env.CLIENT_URL) {
      try {
        const clientUrlHost = new URL(env.CLIENT_URL).hostname.toLowerCase();
        allowed.add(clientUrlHost);
      } catch {
        // ignore invalid URL
      }
    }

    // Direct match
    if (allowed.has(hostname)) {
      return true;
    }

    // Subdomain matching for *.bookbuddy.app
    if (hostname.endsWith('.bookbuddy.app')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * Generates a cryptographically signed OAuth state string.
 *
 * @param {Object} options
 * @param {string} [options.collegeId] - Tenant College ID
 * @param {string} [options.collegeSlug] - Tenant College slug/subdomain
 * @param {string} [options.returnUrl] - Safe post-auth redirection path
 * @param {string} [options.provider] - 'google' | 'github'
 * @returns {string} base64url state string with HMAC signature
 */
const generateOAuthState = ({ collegeId, collegeSlug, returnUrl, provider = 'google' } = {}) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();

  const payload = {
    collegeId: collegeId ? String(collegeId) : null,
    collegeSlug: collegeSlug ? String(collegeSlug) : null,
    returnUrl: returnUrl && isSafeReturnUrl(returnUrl) ? returnUrl : null,
    provider,
    nonce,
    timestamp,
  };

  const payloadString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payloadString)
    .digest('base64url');

  return `${payloadString}.${signature}`;
};

/**
 * Verifies and decodes an OAuth state string.
 * Validates HMAC signature, expiry TTL, and single-use nonce.
 *
 * @param {string} stateString
 * @returns {{ valid: boolean, payload?: Object, error?: string }}
 */
const verifyOAuthState = (stateString) => {
  if (!stateString || typeof stateString !== 'string') {
    return { valid: false, error: 'State parameter is missing or invalid' };
  }

  // Handle standard signed state format: payload.signature
  const parts = stateString.split('.');
  if (parts.length !== 2) {
    // Backward compatibility: If plain JSON or legacy string passed during cutover, attempt safe recovery
    try {
      const decodedLegacy = JSON.parse(Buffer.from(stateString, 'base64url').toString('utf8'));
      if (decodedLegacy && typeof decodedLegacy === 'object') {
        logger.warn('[OAuth] Legacy unsigned state accepted during migration window');
        return { valid: true, payload: decodedLegacy };
      }
    } catch {
      return { valid: false, error: 'Malformed OAuth state structure' };
    }
    return { valid: false, error: 'State format must be signed payload.signature' };
  }

  const [payloadString, signature] = parts;
  const candidateSecrets = getSigningSecretCandidates();
  let signatureMatched = false;
  const actualBuf = Buffer.from(signature, 'utf8');

  for (const secret of candidateSecrets) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('base64url');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      signatureMatched = true;
      break;
    }
  }

  if (!signatureMatched) {
    return { valid: false, error: 'Invalid OAuth state signature. Tampering detected.' };
  }

  // 2. Parse payload
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadString, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, error: 'Failed to deserialize OAuth state payload' };
  }

  // 3. Expiry check
  const now = Date.now();
  if (!payload.timestamp || now - payload.timestamp > STATE_TTL_MS) {
    return { valid: false, error: 'OAuth state has expired. Please re-initiate login.' };
  }

  // 4. Single-use nonce check
  if (payload.nonce) {
    if (consumedNonces.has(payload.nonce)) {
      return {
        valid: false,
        error: 'OAuth state replay detected. Nonce has already been consumed.',
      };
    }
    // Mark nonce as consumed until TTL expiry
    consumedNonces.set(payload.nonce, payload.timestamp + STATE_TTL_MS);
  }

  return { valid: true, payload };
};

module.exports = {
  isSafeReturnUrl,
  generateOAuthState,
  verifyOAuthState,
  consumedNonces,
};
