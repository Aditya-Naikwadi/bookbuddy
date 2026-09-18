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
  "/student": ["student", "college-student"],
  "/student/catalog": ["student", "college-student"],
  "/student/loans": ["student", "college-student"],
  "/student/fines": ["student", "college-student"],
  "/student/card": ["student", "college-student"],
  "/student/e-resources": ["student", "college-student"],
  "/student/reader": ["student", "college-student"],
  "/student/reading-lists": ["student", "college-student"],
  "/student/shelves": ["student", "college-student"],
  "/student/facilities": ["student", "college-student"],
  "/student/support": ["student", "college-student"],
  "/student/engagement": ["student", "college-student"],
  "/student/recommendations": ["student", "college-student"],
  "/student/saved": ["student", "college-student"],
  "/student/feed": ["student", "college-student"],
  "/student/downloads": ["student", "college-student"],
  "/student/cross-college": ["student", "college-student"],
  "/student/profile": ["student", "college-student"],
  "/student/settings": ["student", "college-student"],

  // Legacy Student Routes (Backward Compatibility)
  "/student-dashboard": ["student", "college-student"],
  "/catalog": ["student", "college-student"],
  "/loans": ["student", "college-student"],
  "/fines": ["student", "college-student"],
  "/patron-card": ["student", "college-student"],
  "/e-resources": ["student", "college-student"],
  "/reading-lists": ["student", "college-student"],
  "/recommendations": ["student", "college-student"],
  "/saved": ["student", "college-student"],
  "/lab-booking": ["student", "college-student"],
  "/support": ["student", "college-student"],
  "/achievements": ["student", "college-student"],
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
  return (
    requiredRoles.includes(user.role) ||
    (requiredRoles.includes("student") && user.role === "college-student")
  );
};
