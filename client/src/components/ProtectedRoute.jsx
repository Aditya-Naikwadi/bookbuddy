import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login page but save the location they were trying to access
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect based on role if they are unauthorized for this specific route
    let redirectPath = '/student-dashboard';
    if (user.role === 'college-admin') redirectPath = '/college-admin';
    else if (user.role === 'general') redirectPath = '/general-dashboard';
    else if (user.role === 'super-admin') redirectPath = '/admin-portal';
    
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
