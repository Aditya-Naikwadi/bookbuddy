import { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import useAuthStore from './store/authStore';
import { AnimatePresence } from 'framer-motion';
import { SplashScreen } from './components/ui/SplashScreen';

import ProtectedRoute from './components/ProtectedRoute';

// Lazy loaded public pages
const Landing = lazy(() => import('./pages/public/Landing'));
const RegistrationPage = lazy(() => import('./pages/public/RegistrationPage'));

// Lazy loaded layout components
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const AuthLayout = lazy(() => import('./layouts/AuthLayout'));

// Lazy loaded Auth pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

// Lazy loaded Admin Portal (Super Admin) Features
const AdminDashboardHome = lazy(() => import('./pages/dashboards/admin-portal/AdminDashboardHome'));
const SystemOverview = lazy(() => import('./pages/dashboards/admin-portal/SystemOverview'));
const CollegeAdminManager = lazy(() => import('./pages/dashboards/admin-portal/CollegeAdminManager'));
const OnboardingReviewQueue = lazy(() => import('./pages/dashboards/admin-portal/OnboardingReviewQueue'));
const GlobalContentModeration = lazy(() => import('./pages/dashboards/admin-portal/GlobalContentModeration'));
const AuditLogs = lazy(() => import('./pages/dashboards/admin-portal/AuditLogs'));
const SystemSettings = lazy(() => import('./pages/dashboards/admin-portal/SystemSettings'));

// Lazy loaded College Admin Dashboard Features
const CollegeAdminDashboardHome = lazy(() => import('./pages/dashboards/college-admin/CollegeAdminDashboardHome'));
const PatronManagement = lazy(() => import('./pages/dashboards/college-admin/PatronManagement'));
const Circulation = lazy(() => import('./pages/dashboards/college-admin/Circulation'));
const Cataloging = lazy(() => import('./pages/dashboards/college-admin/Cataloging'));
const DigitalAssets = lazy(() => import('./pages/dashboards/college-admin/DigitalAssets'));
const Inventory = lazy(() => import('./pages/dashboards/college-admin/Inventory'));
const Finances = lazy(() => import('./pages/dashboards/college-admin/Finances'));
const SystemConfig = lazy(() => import('./pages/dashboards/college-admin/SystemConfig'));
const Facilities = lazy(() => import('./pages/dashboards/college-admin/Facilities'));
const Helpdesk = lazy(() => import('./pages/dashboards/college-admin/Helpdesk'));
const Analytics = lazy(() => import('./pages/dashboards/college-admin/Analytics'));
const StudentUploadPage = lazy(() => import('./pages/dashboards/college-admin/StudentUploadPage'));

// Lazy loaded General Dashboard Features
const GeneralDashboardHome = lazy(() => import('./pages/dashboards/general/GeneralDashboardHome'));
const GeneralSearch = lazy(() => import('./pages/dashboards/general/GeneralSearch'));
const GeneralEResources = lazy(() => import('./pages/dashboards/general/GeneralEResources'));
const GeneralSaved = lazy(() => import('./pages/dashboards/general/GeneralSaved'));

// Lazy loaded Student Dashboard Features
const StudentDashboardHome = lazy(() => import('./pages/dashboards/student/StudentDashboardHome'));
const Catalog = lazy(() => import('./pages/dashboards/student/Catalog'));
const MyLoans = lazy(() => import('./pages/dashboards/student/MyLoans'));
const Fines = lazy(() => import('./pages/dashboards/student/Fines'));
const PatronCard = lazy(() => import('./pages/dashboards/student/PatronCard'));
const EResources = lazy(() => import('./pages/dashboards/student/EResources'));
const ReadingLists = lazy(() => import('./pages/dashboards/student/ReadingLists'));
const Recommendations = lazy(() => import('./pages/dashboards/student/Recommendations'));
const SavedBookmarks = lazy(() => import('./pages/dashboards/student/SavedBookmarks'));
const LabBooking = lazy(() => import('./pages/dashboards/student/LabBooking'));
const Support = lazy(() => import('./pages/dashboards/student/Support'));
const EbookReader = lazy(() => import('./pages/dashboards/student/EbookReader'));
const Achievements = lazy(() => import('./pages/dashboards/student/Achievements'));

// Component to redirect authenticated users away from Auth routes
const AuthRedirect = ({ children }) => {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated && user) {
    if (user.role === 'college-admin') return <Navigate to="/college-admin" replace />;
    if (user.role === 'general') return <Navigate to="/general-dashboard" replace />;
    if (user.role === 'super-admin') return <Navigate to="/admin-portal" replace />;
    return <Navigate to="/student-dashboard" replace />;
  }
  return children;
};

// Simple fallback loader for suspense
const PageLoader = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-void">
    <div className="w-12 h-12 border-4 border-ember border-t-transparent rounded-full animate-spin"></div>
  </div>
);

import { QueryProvider } from './providers/QueryProvider';
import { ThemeProvider } from './context/ThemeContext';
import { FeatureFlagProvider } from './context/FeatureFlagContext';
import FeatureGate from './components/common/FeatureGate';

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    // Prevent splash screen from reloading during the same session
    return !sessionStorage.getItem('bookbuddy_splash_shown');
  });

  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleSplashComplete = () => {
    sessionStorage.setItem('bookbuddy_splash_shown', 'true');
    setShowSplash(false);
  };

  return (
    <ThemeProvider>
      <QueryProvider>
        <FeatureFlagProvider>
          <AnimatePresence>
            {showSplash && (
              <SplashScreen onComplete={handleSplashComplete} />
            )}
          </AnimatePresence>
        <Router>
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Landing Page & Dual Registration */}
              <Route path="/" element={<Landing />} />
              <Route path="/register" element={<RegistrationPage />} />

              {/* Auth Routes */}
              <Route path="/auth" element={<AuthRedirect><AuthLayout /></AuthRedirect>}>
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
              </Route>

              {/* Protected Dashboard Routes */}
              <Route element={<DashboardLayout />}>
                
                {/* Admin Portal (Super Admin) Routes */}
                <Route element={<ProtectedRoute allowedRoles={['super-admin']} />}>
                  <Route path="admin-portal" element={<AdminDashboardHome />} />
                  <Route path="admin-portal/overview" element={<SystemOverview />} />
                  <Route path="admin-portal/college-admins" element={<CollegeAdminManager />} />
                  <Route path="admin-portal/registration-queue" element={<OnboardingReviewQueue />} />
                  <Route path="admin-portal/moderation" element={<GlobalContentModeration />} />
                  <Route path="admin-portal/audit-logs" element={<AuditLogs />} />
                  <Route path="admin-portal/settings" element={<SystemSettings />} />
                </Route>

                {/* College Admin Routes */}
                <Route element={<ProtectedRoute allowedRoles={['college-admin']} />}>
                  <Route path="college-admin" element={<CollegeAdminDashboardHome />} />
                  <Route path="college-admin/bulk-upload" element={<StudentUploadPage />} />
                  <Route path="college-admin/patrons" element={<PatronManagement />} />
                  <Route path="college-admin/circulation" element={<Circulation />} />
                  <Route path="college-admin/cataloging" element={<Cataloging />} />
                  <Route path="college-admin/digital-assets" element={<DigitalAssets />} />
                  <Route path="college-admin/inventory" element={<Inventory />} />
                  <Route path="college-admin/finances" element={<Finances />} />
                  <Route path="college-admin/system-config" element={<SystemConfig />} />
                  <Route path="college-admin/facilities" element={<Facilities />} />
                  <Route path="college-admin/helpdesk" element={<Helpdesk />} />
                  <Route path="college-admin/analytics" element={<Analytics />} />
                </Route>

                {/* General Dashboard Routes */}
                <Route element={<ProtectedRoute allowedRoles={['general']} />}>
                  <Route path="general-dashboard" element={<GeneralDashboardHome />} />
                  <Route path="general-dashboard/search" element={<GeneralSearch />} />
                  <Route path="general-dashboard/e-resources" element={<GeneralEResources />} />
                  <Route path="general-dashboard/saved" element={<GeneralSaved />} />
                </Route>

                {/* Student Specific Routes */}
                <Route element={<ProtectedRoute allowedRoles={['student']} />}>
                  <Route path="student-dashboard" element={<StudentDashboardHome />} />
                  <Route path="catalog" element={<FeatureGate feature="catalog" isPageGate><Catalog /></FeatureGate>} />
                  <Route path="loans" element={<FeatureGate feature="loans" isPageGate><MyLoans /></FeatureGate>} />
                  <Route path="fines" element={<FeatureGate feature="fines" isPageGate><Fines /></FeatureGate>} />
                  <Route path="patron-card" element={<FeatureGate feature="patron-card" isPageGate><PatronCard /></FeatureGate>} />
                  <Route path="e-resources" element={<FeatureGate feature="e-resources" isPageGate><EResources /></FeatureGate>} />
                  <Route path="reading-lists" element={<FeatureGate feature="reading-lists" isPageGate><ReadingLists /></FeatureGate>} />
                  <Route path="recommendations" element={<FeatureGate feature="recommendations" isPageGate><Recommendations /></FeatureGate>} />
                  <Route path="saved" element={<FeatureGate feature="saved" isPageGate><SavedBookmarks /></FeatureGate>} />
                  <Route path="lab-booking" element={<FeatureGate feature="facilities" isPageGate><LabBooking /></FeatureGate>} />
                  <Route path="support" element={<FeatureGate feature="support" isPageGate><Support /></FeatureGate>} />
                  <Route path="achievements" element={<FeatureGate feature="gamification" isPageGate><Achievements /></FeatureGate>} />
                </Route>
              </Route>

              {/* Fullscreen Reader Route (Protected but outside dashboard layout) */}
              <Route element={<ProtectedRoute allowedRoles={['student', 'general']} />}>
                <Route path="/eresources/read/:resourceId" element={<EbookReader />} />
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Router>
    </FeatureFlagProvider>
    </QueryProvider>
    </ThemeProvider>
  );
}

export default App;
