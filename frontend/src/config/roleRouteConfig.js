const COLLEGE_ADMIN_ROLES = [
  "college-admin",
  "college_admin",
  "admin",
  "librarian",
  "super-admin",
  "super_admin",
];

// Single source of truth mapping frontend routes to required roles
export const ROLE_ROUTE_MAP = {
  // Super Admin Routes
  "/admin-portal": ["super-admin", "super_admin"],
  "/admin-portal/overview": ["super-admin", "super_admin"],
  "/admin-portal/college-admins": ["super-admin", "super_admin"],
  "/admin-portal/registration-queue": ["super-admin", "super_admin"],
  "/admin-portal/moderation": ["super-admin", "super_admin"],
  "/admin-portal/audit-logs": ["super-admin", "super_admin"],
  "/admin-portal/settings": ["super-admin", "super_admin"],
  "/admin-portal/users": ["super-admin", "super_admin"],
  "/admin-portal/data-oversight": ["super-admin", "super_admin"],
  "/admin-portal/support": ["super-admin", "super_admin"],

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
  "/general-dashboard": ["general"],
  "/general-dashboard/search": ["general"],
  "/general-dashboard/e-resources": ["general"],
  "/general-dashboard/saved": ["general"],

  // Student Routes (Canonical /student/* prefix)
  "/student": ["student"],
  "/student/catalog": ["student"],
  "/student/loans": ["student"],
  "/student/fines": ["student"],
  "/student/card": ["student"],
  "/student/e-resources": ["student"],
  "/student/reader": ["student"],
  "/student/reading-lists": ["student"],
  "/student/shelves": ["student"],
  "/student/facilities": ["student"],
  "/student/support": ["student"],
  "/student/engagement": ["student"],
  "/student/recommendations": ["student"],
  "/student/saved": ["student"],
  "/student/feed": ["student"],
  "/student/downloads": ["student"],
  "/student/cross-college": ["student"],
  "/student/profile": ["student"],
  "/student/settings": ["student"],

  // Legacy Student Routes (Backward Compatibility)
  "/student-dashboard": ["student"],
  "/catalog": ["student"],
  "/loans": ["student"],
  "/fines": ["student"],
  "/patron-card": ["student"],
  "/e-resources": ["student"],
  "/reading-lists": ["student"],
  "/recommendations": ["student"],
  "/saved": ["student"],
  "/lab-booking": ["student"],
  "/support": ["student"],
  "/achievements": ["student"],
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
  return requiredRoles.includes(user.role);
};
