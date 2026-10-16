/**
 * Canonical Socket.io event names and descriptions.
 * Follows the strict entity:action naming convention.
 */
const events = {
  // === Canonical entity:action Events ===
  LOAN_ISSUED: 'loan:issued',
  LOAN_RETURNED: 'loan:returned',
  LOAN_RENEWED: 'loan:renewed',
  RESERVATION_READY: 'reservation:ready',
  BOOK_UPDATED: 'book:updated',
  FINE_CREATED: 'fine:created',
  FINE_PAID: 'fine:paid',
  SEAT_BOOKED: 'seat:booked',
  SEAT_NO_SHOW: 'seat:no_show',
  STREAK_UPDATED: 'streak:updated',
  BADGE_UNLOCKED: 'badge:unlocked',
  NOTIFICATION_NEW: 'notification:new',
  DASHBOARD_STATS: 'dashboard:stats',

  // === Backward-Compatible Aliases ===
  LOAN_CHECKOUT: 'loan:checkout',
  LOAN_RETURN: 'loan:return',
  RESERVATION_CREATED: 'reservation:created',
  ACQUISITION_UPDATED: 'acquisition:updated',
};

const toCleanObject = (val) => {
  if (!val) return val;
  if (typeof val !== 'object') return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val._bsontype === 'string' || val._id) {
    // If Mongoose document or ObjectId
    if (typeof val.toObject === 'function') {
      return toCleanObject(val.toObject());
    }
  }
  if (Array.isArray(val)) {
    return val.map(toCleanObject);
  }
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    if (k.startsWith('$') || k === '_doc' || k === '__v') continue;
    out[k] = toCleanObject(v);
  }
  return out;
};

/**
 * Standard event payload factory
 * @param {Object} params
 * @param {string} params.entityId
 * @param {string} params.collegeId
 * @param {string} [params.updatedAt]
 * @param {Object} [params.changed]
 * @param {Object} [params.extra]
 */
const createEventPayload = ({
  entityId,
  collegeId,
  updatedAt = new Date().toISOString(),
  changed = {},
  ...extra
}) => ({
  entityId: String(entityId || ''),
  collegeId: collegeId ? String(collegeId) : null,
  updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date(updatedAt).toISOString(),
  changed: toCleanObject(changed) || {},
  ...toCleanObject(extra),
});

module.exports = {
  events,
  createEventPayload,
  // Direct export of event constants for convenience
  ...events,
};
