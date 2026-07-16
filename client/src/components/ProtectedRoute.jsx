import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

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
