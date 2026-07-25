import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { isUserAllowedForRoute } from '../config/roleRouteConfig';

const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-void">
        <div className="w-12 h-12 border-4 border-ember border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page but save the location they were trying to access
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Verify explicit allowedRoles prop or role-route configuration
  const isRolePermitted = allowedRoles
    ? user && allowedRoles.includes(user.role)
    : isUserAllowedForRoute(user, location.pathname);

  if (!isRolePermitted) {
    // Redirect authenticated users with wrong roles to dedicated 403 page
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
