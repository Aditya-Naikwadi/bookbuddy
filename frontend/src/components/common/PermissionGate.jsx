import React from "react";
import useAuthStore from "../../store/authStore";

/**
 * PermissionGate conditionally renders children based on user permissions or sub-roles.
 *
 * @param {string|string[]} permission - Required permission key(s) (e.g., 'canManageAcquisitions')
 * @param {string|string[]} allowedRoles - Optional allowed top-level roles
 * @param {React.ReactNode} fallback - Rendered when permission check fails
 * @param {React.ReactNode} children - Rendered when user has permission
 */
export function PermissionGate({
  permission,
  allowedRoles,
  fallback = null,
  children,
}) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return fallback ? <>{fallback}</> : null;
  }

  // Super-admin root bypass
  if (
    user.role === "super-admin" &&
    (!user.subRole || user.subRole === "root_admin")
  ) {
    return <>{children}</>;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const roleList = Array.isArray(allowedRoles)
      ? allowedRoles
      : [allowedRoles];
    if (!roleList.includes(user.role)) {
      return fallback ? <>{fallback}</> : null;
    }
  }

  if (!permission) {
    return <>{children}</>;
  }

  const permissionsToCheck = Array.isArray(permission)
    ? permission
    : [permission];
  const userPermissions = user.permissions;

  let hasPermission = false;
  if (!userPermissions) {
    hasPermission = user.role === "college-admin";
  } else if (Array.isArray(userPermissions)) {
    hasPermission = permissionsToCheck.some((p) => userPermissions.includes(p));
  } else if (typeof userPermissions === "object") {
    hasPermission = permissionsToCheck.every(
      (p) =>
        userPermissions[p] === true ||
        (userPermissions[p] === undefined && user.role === "college-admin"),
    );
  }

  if (hasPermission) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

export default PermissionGate;
