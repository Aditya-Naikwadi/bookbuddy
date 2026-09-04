const AppError = require('./AppError');

/**
 * F6.2 — Explicit State Transition Table for ILL Share Requests
 */
const TRANSITION_TABLE = {
  requested: ['approved', 'rejected'],
  approved: ['in_transit', 'rejected'],
  in_transit: ['fulfilled', 'rejected'],
  fulfilled: [],
  rejected: [],
};

/**
 * Check if a state transition is valid
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
const canTransition = (fromStatus, toStatus) => {
  if (!fromStatus || !toStatus) return false;
  if (fromStatus === toStatus) return true; // No-op transition is allowed

  const allowedNextStates = TRANSITION_TABLE[fromStatus] || [];
  return allowedNextStates.includes(toStatus);
};

/**
 * Validate state transition and throw 400 AppError if invalid
 * @param {string} fromStatus
 * @param {string} toStatus
 */
const validateTransition = (fromStatus, toStatus) => {
  if (!canTransition(fromStatus, toStatus)) {
    throw new AppError(
      `Invalid share request status transition from '${fromStatus}' to '${toStatus}'. Direct state skipping is strictly forbidden by state machine rules.`,
      400
    );
  }
};

module.exports = {
  TRANSITION_TABLE,
  canTransition,
  validateTransition,
};
