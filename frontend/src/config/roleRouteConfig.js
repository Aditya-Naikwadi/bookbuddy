import { ROLES, normalizeRole } from "@bookbuddy/shared";

const SUPER_ADMIN_ROLES = Object.freeze([ROLES.SUPER_ADMIN]);
const COLLEGE_ADMIN_ROLES = Object.freeze([
  ROLES.COLLEGE_ADMIN,
  ROLES.SUPER_ADMIN,
]);
const GENERAL_ROLES = Object.freeze([ROLES.GENERAL]);
const STUDENT_ROLES = Object.freeze([ROLES.STUDENT]);

// Single source of truth mapping frontend routes to canonical required roles
export const ROLE_ROUTE_MAP = {
  // Super Admin Routes
  "/admin-portal": SUPER_ADMIN_ROLES,
  "/admin-portal/overview": SUPER_ADMIN_ROLES,
  "/admin-portal/college-admins": SUPER_ADMIN_ROLES,
  "/admin-portal/registration-queue": SUPER_ADMIN_ROLES,
  "/admin-portal/moderation": SUPER_ADMIN_ROLES,
  "/admin-portal/audit-logs": SUPER_ADMIN_ROLES,
  "/admin-portal/settings": SUPER_ADMIN_ROLES,
  "/admin-portal/users": SUPER_ADMIN_ROLES,
  "/admin-portal/data-oversight": SUPER_ADMIN_ROLES,
  "/admin-portal/support": SUPER_ADMIN_ROLES,

  // College Admin Routes
  "/college-admin": COLLEGE_ADMIN_ROLES,
  "/college-admin/bulk-upload": COLLEGE_ADMIN_ROLES,
  "/college-admin/patrons": COLLEGE_ADMIN_ROLES,
  "/college-admin/circulation": COLLEGE_ADMIN_ROLES,
  "/college-admin/cataloging": COLLEGE_ADMIN_ROLES,
  "/college-admin/digital-assets": COLLEGE_ADMIN_ROLES,
  "/college-admin/inventory": COLLEGE_ADMIN_ROLES,
  "/college-admin/finances": COLLEGE_ADMIN_ROLES,
  "/college-admin/features": COLLEGE_ADMIN_ROLES,
  "/college-admin/system-config": COLLEGE_ADMIN_ROLES,
  "/college-admin/facilities": COLLEGE_ADMIN_ROLES,
  "/college-admin/helpdesk": COLLEGE_ADMIN_ROLES,
  "/college-admin/analytics": COLLEGE_ADMIN_ROLES,
  "/college-admin/acquisitions": COLLEGE_ADMIN_ROLES,
  "/college-admin/share-requests": COLLEGE_ADMIN_ROLES,

  // General Dashboard Routes
  "/general-dashboard": GENERAL_ROLES,
  "/general-dashboard/search": GENERAL_ROLES,
  "/general-dashboard/e-resources": GENERAL_ROLES,
  "/general-dashboard/saved": GENERAL_ROLES,

  // Student Routes (Canonical /student/* prefix)
  "/student": STUDENT_ROLES,
  "/student/catalog": STUDENT_ROLES,
  "/student/loans": STUDENT_ROLES,
  "/student/fines": STUDENT_ROLES,
  "/student/card": STUDENT_ROLES,
  "/student/e-resources": STUDENT_ROLES,
  "/student/reader": STUDENT_ROLES,
  "/student/reading-lists": STUDENT_ROLES,
  "/student/shelves": STUDENT_ROLES,
  "/student/facilities": STUDENT_ROLES,
  "/student/support": STUDENT_ROLES,
  "/student/engagement": STUDENT_ROLES,
  "/student/recommendations": STUDENT_ROLES,
  "/student/saved": STUDENT_ROLES,
  "/student/feed": STUDENT_ROLES,
  "/student/downloads": STUDENT_ROLES,
  "/student/cross-college": STUDENT_ROLES,
  "/student/profile": STUDENT_ROLES,
  "/student/settings": STUDENT_ROLES,

  // Legacy Student Routes (Backward Compatibility)
  "/student-dashboard": STUDENT_ROLES,
  "/catalog": STUDENT_ROLES,
  "/loans": STUDENT_ROLES,
  "/fines": STUDENT_ROLES,
  "/patron-card": STUDENT_ROLES,
  "/e-resources": STUDENT_ROLES,
  "/reading-lists": STUDENT_ROLES,
  "/recommendations": STUDENT_ROLES,
  "/saved": STUDENT_ROLES,
  "/lab-booking": STUDENT_ROLES,
  "/support": STUDENT_ROLES,
  "/achievements": STUDENT_ROLES,
};

export const getRequiredRolesForRoute = (pathname) => {
  if (ROLE_ROUTE_MAP[pathname]) {
    return ROLE_ROUTE_MAP[pathname];
  }

  // Prefix match check for nested routes
  const matchingKey = Object.keys(ROLE_ROUTE_MAP).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  return matchingKey ? ROLE_ROUTE_MAP[matchingKey] : null;
};

export const isUserAllowedForRoute = (user, pathname) => {
  const requiredRoles = getRequiredRolesForRoute(pathname);
  if (!requiredRoles) return true; // Public route
  if (!user || !user.role) return false;
  const canonicalRole = normalizeRole(user.role);
  return requiredRoles.includes(canonicalRole);
};
