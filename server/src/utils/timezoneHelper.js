const { DateTime } = require('luxon');

/**
 * Checks if a given time is in the midnight hour (00:00 - 00:59) in a specific timezone.
 *
 * @param {Date} time
 * @param {string} timezone
 * @returns {boolean}
 */
const isMidnight = (time, timezone) => {
  try {
    const dt = DateTime.fromJSDate(time).setZone(timezone);
    return dt.hour === 0;
  } catch (err) {
    console.error('timezoneHelper.isMidnight error:', err);
    // Fallback to UTC if timezone is invalid
    return time.getUTCHours() === 0;
  }
};

/**
 * Checks if a given time is exactly N hours before midnight in a specific timezone.
 * E.g., if hoursBefore is 3, local midnight is 00:00, so 3 hours before is 21:00 (9 PM).
 *
 * @param {Date} time
 * @param {string} timezone
 * @param {number} hoursBefore
 * @returns {boolean}
 */
const isHoursBeforeMidnight = (time, timezone, hoursBefore) => {
  try {
    const dt = DateTime.fromJSDate(time).setZone(timezone);
    const targetHour = (24 - hoursBefore) % 24;
    return dt.hour === targetHour;
  } catch (err) {
    // Fallback to UTC if timezone is invalid
    const targetHour = (24 - hoursBefore) % 24;
    return time.getUTCHours() === targetHour;
  }
};

module.exports = {
  isMidnight,
  isHoursBeforeMidnight,
};
