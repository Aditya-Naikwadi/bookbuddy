const { ROLES, CANONICAL_ROLES } = require('../constants/roles');

/**
 * Normalizes an email address:
 * - Trims leading and trailing whitespace
 * - Converts to lowercase
 * - Returns empty string if undefined/null/empty
 */
function normalizeEmail(email) {
  if (email === undefined || email === null) return '';
  return String(email).trim().toLowerCase();
}

/**
 * Normalizes a student ID:
 * - Trims leading and trailing whitespace
 * - Converts to lowercase
 * - Returns empty string if undefined/null/empty
 */
function normalizeStudentId(studentId) {
  if (studentId === undefined || studentId === null) return '';
  return String(studentId).trim().toLowerCase();
}

/**
 * Normalizes a general identity string (e.g. identifier at login):
 * - Trims leading and trailing whitespace
 * - Converts to lowercase
 */
function normalizeIdentity(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().toLowerCase();
}

/**
 * Normalizes user role to canonical representation:
 * - 'student' / 'college-student' / 'collegestudent' -> 'student'
 * - 'college-admin' / 'college_admin' / 'collegeadmin' / 'admin' / 'librarian' -> 'college-admin'
 * - 'super-admin' / 'super_admin' / 'superadmin' -> 'super-admin'
 * - 'general' -> 'general'
 * Defaults to 'student' if empty/null, or preserves canonical role.
 */
function normalizeRole(role) {
  if (!role || typeof role !== 'string') return ROLES.STUDENT;

  const raw = role.trim().toLowerCase();

  switch (raw) {
    case 'college-student':
    case 'college_student':
    case 'collegestudent':
    case 'student':
      return ROLES.STUDENT;

    case 'college-admin':
    case 'college_admin':
    case 'collegeadmin':
    case 'admin':
    case 'librarian':
      return ROLES.COLLEGE_ADMIN;

    case 'super-admin':
    case 'super_admin':
    case 'superadmin':
      return ROLES.SUPER_ADMIN;

    case 'general':
      return ROLES.GENERAL;

    default:
      if (CANONICAL_ROLES.includes(raw)) {
        return raw;
      }
      return ROLES.STUDENT;
  }
}

module.exports = {
  normalizeEmail,
  normalizeStudentId,
  normalizeIdentity,
  normalizeRole,
};
