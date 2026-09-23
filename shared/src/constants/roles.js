/**
 * Canonical Role Constants & Groupings for BookBuddy
 * Single source of truth shared by backend and frontend.
 */

const ROLES = Object.freeze({
  STUDENT: 'student',
  GENERAL: 'general',
  COLLEGE_ADMIN: 'college-admin',
  SUPER_ADMIN: 'super-admin',
});

const CANONICAL_ROLES = Object.freeze([
  ROLES.STUDENT,
  ROLES.GENERAL,
  ROLES.COLLEGE_ADMIN,
  ROLES.SUPER_ADMIN,
]);

const ROLE_GROUPS = Object.freeze({
  PATRON_ROLES: Object.freeze([ROLES.STUDENT, ROLES.GENERAL]),
  STUDENT_ROLES: Object.freeze([ROLES.STUDENT]),
  COLLEGE_ADMIN_ROLES: Object.freeze([ROLES.COLLEGE_ADMIN]),
  SUPER_ADMIN_ROLES: Object.freeze([ROLES.SUPER_ADMIN]),
  ADMIN_ROLES: Object.freeze([ROLES.COLLEGE_ADMIN, ROLES.SUPER_ADMIN]),
  ALL_AUTHENTICATED_ROLES: CANONICAL_ROLES,
});

module.exports = {
  ROLES,
  CANONICAL_ROLES,
  ROLE_GROUPS,
};
