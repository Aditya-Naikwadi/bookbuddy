// Single source of truth mapping frontend routes to required roles
export const ROLE_ROUTE_MAP = {
  // Super Admin Routes
  "/admin-portal": ["super-admin"],
  "/admin-portal/overview": ["super-admin"],
  "/admin-portal/college-admins": ["super-admin"],
  "/admin-portal/registration-queue": ["super-admin"],
  "/admin-portal/moderation": ["super-admin"],
  "/admin-portal/audit-logs": ["super-admin"],
  "/admin-portal/settings": ["super-admin"],

  // College Admin Routes
  "/college-admin": ["college-admin", "admin", "librarian"],
  "/college-admin/bulk-upload": ["college-admin", "admin", "librarian"],
  "/college-admin/patrons": ["college-admin", "admin", "librarian"],
  "/college-admin/circulation": ["college-admin", "admin", "librarian"],
  "/college-admin/cataloging": ["college-admin", "admin", "librarian"],
  "/college-admin/digital-assets": ["college-admin", "admin", "librarian"],
  "/college-admin/inventory": ["college-admin", "admin", "librarian"],
  "/college-admin/finances": ["college-admin", "admin", "librarian"],
  "/college-admin/system-config": ["college-admin", "admin", "librarian"],
  "/college-admin/facilities": ["college-admin", "admin", "librarian"],
  "/college-admin/helpdesk": ["college-admin", "admin", "librarian"],
  "/college-admin/analytics": ["college-admin", "admin", "librarian"],

  // General Dashboard Routes
  "/general-dashboard": ["general"],
  "/general-dashboard/search": ["general"],
  "/general-dashboard/e-resources": ["general"],
  "/general-dashboard/saved": ["general"],

  // Student Routes
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
