import { Suspense, lazy, useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import useAuthStore from "./store/authStore";
import { AnimatePresence } from "framer-motion";
import { SplashScreen } from "./components/ui/SplashScreen";

import ProtectedRoute from "./components/ProtectedRoute";
import ImpersonationBanner from "./components/ImpersonationBanner";

// Lazy loaded public pages
const Landing = lazy(() => import("./pages/public/Landing"));
const RegistrationPage = lazy(() => import("./pages/public/RegistrationPage"));
const CollegeStudentRegister = lazy(
  () => import("./pages/public/CollegeStudentRegister"),
);
const CollegeDeepLinkEntry = lazy(
  () => import("./pages/public/CollegeDeepLinkEntry"),
);
const Unauthorized = lazy(() => import("./pages/Unauthorized"));

// Lazy loaded layout components
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const AuthLayout = lazy(() => import("./layouts/AuthLayout"));

// Lazy loaded Auth pages
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

// Lazy loaded Admin Portal (Super Admin) Features
const AdminDashboardHome = lazy(
  () => import("./pages/dashboards/admin-portal/AdminDashboardHome"),
);
const SystemOverview = lazy(
  () => import("./pages/dashboards/admin-portal/SystemOverview"),
);
const CollegeAdminManager = lazy(
  () => import("./pages/dashboards/admin-portal/CollegeAdminManager"),
);
const OnboardingReviewQueue = lazy(
  () => import("./pages/dashboards/admin-portal/OnboardingReviewQueue"),
);
const GlobalContentModeration = lazy(
  () => import("./pages/dashboards/admin-portal/GlobalContentModeration"),
);
const AuditLogs = lazy(
  () => import("./pages/dashboards/admin-portal/AuditLogs"),
);
const SystemSettings = lazy(
  () => import("./pages/dashboards/admin-portal/SystemSettings"),
);
const UserManagement = lazy(
  () => import("./pages/dashboards/admin-portal/UserManagement"),
);
const GlobalDataOversight = lazy(
  () => import("./pages/dashboards/admin-portal/GlobalDataOversight"),
);
const GlobalSupportQueue = lazy(
  () => import("./pages/dashboards/admin-portal/GlobalSupportQueue"),
);

// Lazy loaded College Admin Dashboard Features
const CollegeAdminDashboardHome = lazy(
  () => import("./pages/dashboards/college-admin/CollegeAdminDashboardHome"),
);
const FeatureManagerSettings = lazy(
  () => import("./pages/dashboards/college-admin/FeatureManagerSettings"),
);
const StudentUploadPage = lazy(
  () => import("./pages/dashboards/college-admin/StudentUploadPage"),
);
const CirculationDesk = lazy(
  () => import("./pages/dashboards/college-admin/CirculationDesk"),
);
const PatronsDesk = lazy(
  () => import("./pages/dashboards/college-admin/PatronsDesk"),
);
const CatalogingDesk = lazy(
  () => import("./pages/dashboards/college-admin/CatalogingDesk"),
);
const InventoryOverview = lazy(
  () => import("./pages/dashboards/college-admin/InventoryOverview"),
);
const FinancesDesk = lazy(
  () => import("./pages/dashboards/college-admin/FinancesDesk"),
);
const FacilitiesDesk = lazy(
  () => import("./pages/dashboards/college-admin/FacilitiesDesk"),
);
const DigitalAssetsDesk = lazy(
  () => import("./pages/dashboards/college-admin/DigitalAssetsDesk"),
);
const HelpdeskDesk = lazy(
  () => import("./pages/dashboards/college-admin/HelpdeskDesk"),
);
const AnalyticsOverview = lazy(
  () => import("./pages/dashboards/college-admin/AnalyticsOverview"),
);

// Lazy loaded General Dashboard Features
const GeneralDashboardHome = lazy(
  () => import("./pages/dashboards/general/GeneralDashboardHome"),
);
const GeneralSearch = lazy(
  () => import("./pages/dashboards/general/GeneralSearch"),
);
const GeneralEResources = lazy(
  () => import("./pages/dashboards/general/GeneralEResources"),
);
const GeneralSaved = lazy(
  () => import("./pages/dashboards/general/GeneralSaved"),
);

// Lazy loaded Student Dashboard Features
const StudentDashboardHome = lazy(
  () => import("./pages/dashboards/student/StudentDashboardHome"),
);
const Catalog = lazy(() => import("./pages/dashboards/student/Catalog"));
const MyLoans = lazy(() => import("./pages/dashboards/student/MyLoans"));
const Fines = lazy(() => import("./pages/dashboards/student/Fines"));
const PatronCard = lazy(() => import("./pages/dashboards/student/PatronCard"));
const EResources = lazy(() => import("./pages/dashboards/student/EResources"));
const ReadingLists = lazy(
  () => import("./pages/dashboards/student/ReadingLists"),
);
const Recommendations = lazy(
  () => import("./pages/dashboards/student/Recommendations"),
);
const SavedBookmarks = lazy(
  () => import("./pages/dashboards/student/SavedBookmarks"),
);
const LabBooking = lazy(() => import("./pages/dashboards/student/LabBooking"));
const Support = lazy(() => import("./pages/dashboards/student/Support"));
const EbookReader = lazy(
  () => import("./pages/dashboards/student/EbookReader"),
);
const Achievements = lazy(
  () => import("./pages/dashboards/student/Achievements"),
);
const Downloads = lazy(() => import("./pages/Downloads"));
const MyShelves = lazy(() => import("./pages/MyShelves"));
const Feed = lazy(() => import("./pages/Feed"));
const IncomingShareRequests = lazy(
  () => import("./pages/dashboards/admin/IncomingShareRequests"),
);
const CrossCollegeCatalog = lazy(() => import("./pages/CrossCollegeCatalog"));

// Component to redirect authenticated users away from Auth routes
const AuthRedirect = ({ children }) => {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated && user) {
    if (
      ["college-admin", "college_admin", "admin", "librarian"].includes(
        user.role,
      )
    )
      return <Navigate to="/college-admin" replace />;
    if (user.role === "general")
      return <Navigate to="/general-dashboard" replace />;
    if (user.role === "super-admin")
      return <Navigate to="/admin-portal" replace />;
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

import { QueryProvider } from "./providers/QueryProvider";
import { ThemeProvider } from "./context/ThemeContext";
import { FeatureFlagProvider } from "./context/FeatureFlagContext";
import FeatureGate from "./components/common/FeatureGate";

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    // Prevent splash screen from reloading during the same session
    return !sessionStorage.getItem("bookbuddy_splash_shown");
  });

  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleSplashComplete = () => {
    sessionStorage.setItem("bookbuddy_splash_shown", "true");
    setShowSplash(false);
  };

  return (
    <ThemeProvider>
      <QueryProvider>
        <FeatureFlagProvider>
          <AnimatePresence>
            {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
          </AnimatePresence>
          <Router>
            <ImpersonationBanner />
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Landing Page & Dual Registration & College Deep Links */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/register" element={<RegistrationPage />} />
                  <Route
                    path="/register/:collegeSlug"
                    element={<CollegeStudentRegister />}
                  />
                  <Route
                    path="/c/:collegeSlug/*"
                    element={<CollegeDeepLinkEntry />}
                  />
                  <Route
                    path="/c/:collegeSlug"
                    element={<CollegeDeepLinkEntry />}
                  />
                  <Route path="/unauthorized" element={<Unauthorized />} />

                  {/* Top-level Route Aliases & Fallbacks */}
                  <Route
                    path="/login"
                    element={<Navigate to="/auth/login" replace />}
                  />

                  {/* Auth Routes */}
                  <Route
                    path="/auth"
                    element={
                      <AuthRedirect>
                        <AuthLayout />
                      </AuthRedirect>
                    }
                  >
                    <Route
                      index
                      element={<Navigate to="/auth/login" replace />}
                    />
                    <Route path="login" element={<Login />} />
                    <Route path="register" element={<Register />} />
                  </Route>

                  {/* Protected Dashboard Routes */}
                  <Route element={<DashboardLayout />}>
                    {/* Admin Portal (Super Admin) Routes */}
                    <Route
                      element={
                        <ProtectedRoute allowedRoles={["super-admin"]} />
                      }
                    >
                      <Route
                        path="admin-portal"
                        element={<AdminDashboardHome />}
                      />
                      <Route
                        path="admin-portal/overview"
                        element={<SystemOverview />}
                      />
                      <Route
                        path="admin-portal/college-admins"
                        element={<CollegeAdminManager />}
                      />
                      <Route
                        path="admin-portal/registration-queue"
                        element={<OnboardingReviewQueue />}
                      />
                      <Route
                        path="admin-portal/moderation"
                        element={<GlobalContentModeration />}
                      />
                      <Route
                        path="admin-portal/audit-logs"
                        element={<AuditLogs />}
                      />
                      <Route
                        path="admin-portal/settings"
                        element={<SystemSettings />}
                      />
                      <Route
                        path="admin-portal/users"
                        element={<UserManagement />}
                      />
                      <Route
                        path="admin-portal/data-oversight"
                        element={<GlobalDataOversight />}
                      />
                      <Route
                        path="admin-portal/support"
                        element={<GlobalSupportQueue />}
                      />
                    </Route>

                    {/* College Admin Routes */}
                    <Route
                      element={
                        <ProtectedRoute
                          allowedRoles={[
                            "college-admin",
                            "college_admin",
                            "admin",
                            "librarian",
                          ]}
                        />
                      }
                    >
                      <Route
                        path="college-admin"
                        element={<CollegeAdminDashboardHome />}
                      />
                      <Route
                        path="college-admin/features"
                        element={<FeatureManagerSettings />}
                      />
                      <Route
                        path="college-admin/bulk-upload"
                        element={<StudentUploadPage />}
                      />
                      <Route
                        path="college-admin/circulation"
                        element={<CirculationDesk />}
                      />
                      <Route
                        path="college-admin/patrons"
                        element={<PatronsDesk />}
                      />
                      <Route
                        path="college-admin/cataloging"
                        element={<CatalogingDesk />}
                      />
                      <Route
                        path="college-admin/inventory"
                        element={<InventoryOverview />}
                      />
                      <Route
                        path="college-admin/finances"
                        element={<FinancesDesk />}
                      />
                      <Route
                        path="college-admin/facilities"
                        element={<FacilitiesDesk />}
                      />
                      <Route
                        path="college-admin/digital-assets"
                        element={<DigitalAssetsDesk />}
                      />
                      <Route
                        path="college-admin/helpdesk"
                        element={<HelpdeskDesk />}
                      />
                      <Route
                        path="college-admin/share-requests"
                        element={<IncomingShareRequests />}
                      />
                      <Route
                        path="college-admin/analytics"
                        element={<AnalyticsOverview />}
                      />
                    </Route>

                    {/* General Dashboard Routes */}
                    <Route
                      element={<ProtectedRoute allowedRoles={["general"]} />}
                    >
                      <Route
                        path="general-dashboard"
                        element={<GeneralDashboardHome />}
                      />
                      <Route
                        path="general-dashboard/search"
                        element={<GeneralSearch />}
                      />
                      <Route
                        path="general-dashboard/e-resources"
                        element={<GeneralEResources />}
                      />
                      <Route
                        path="general-dashboard/saved"
                        element={<GeneralSaved />}
                      />
                    </Route>

                    {/* Student Specific Routes */}
                    <Route
                      element={<ProtectedRoute allowedRoles={["student"]} />}
                    >
                      <Route
                        path="student-dashboard"
                        element={<StudentDashboardHome />}
                      />
                      <Route
                        path="catalog"
                        element={
                          <FeatureGate feature="catalog" isPageGate>
                            <Catalog />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="loans"
                        element={
                          <FeatureGate feature="loans" isPageGate>
                            <MyLoans />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="fines"
                        element={
                          <FeatureGate feature="fines" isPageGate>
                            <Fines />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="patron-card"
                        element={
                          <FeatureGate feature="patron-card" isPageGate>
                            <PatronCard />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="e-resources"
                        element={
                          <FeatureGate feature="e-resources" isPageGate>
                            <EResources />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="reading-lists"
                        element={
                          <FeatureGate feature="reading-lists" isPageGate>
                            <ReadingLists />
                          </FeatureGate>
                        }
                      />
                      <Route path="shelves" element={<MyShelves />} />
                      <Route path="my-shelves" element={<MyShelves />} />
                      <Route
                        path="recommendations"
                        element={
                          <FeatureGate feature="recommendations" isPageGate>
                            <Recommendations />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="saved"
                        element={
                          <FeatureGate feature="saved" isPageGate>
                            <SavedBookmarks />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="lab-booking"
                        element={
                          <FeatureGate feature="facilities" isPageGate>
                            <LabBooking />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="support"
                        element={
                          <FeatureGate feature="support" isPageGate>
                            <Support />
                          </FeatureGate>
                        }
                      />
                      <Route
                        path="achievements"
                        element={
                          <FeatureGate feature="gamification" isPageGate>
                            <Achievements />
                          </FeatureGate>
                        }
                      />
                      <Route path="feed" element={<Feed />} />
                      <Route path="campus-feed" element={<Feed />} />
                      <Route
                        path="cross-college"
                        element={<CrossCollegeCatalog />}
                      />
                      <Route path="fines" element={<Fines />} />
                      <Route path="checkout" element={<Fines />} />
                      <Route path="downloads" element={<Downloads />} />
                      <Route path="offline-downloads" element={<Downloads />} />
                    </Route>
                  </Route>

                  {/* Standalone Downloads & Reader Routes */}
                  <Route
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "student",
                          "general",
                          "college-admin",
                          "super-admin",
                        ]}
                      />
                    }
                  >
                    <Route path="/downloads" element={<Downloads />} />
                  </Route>

                  {/* Fullscreen Reader Route (Protected but outside dashboard layout) */}
                  <Route
                    element={
                      <ProtectedRoute allowedRoles={["student", "general"]} />
                    }
                  >
                    <Route
                      path="/eresources/read/:resourceId"
                      element={<EbookReader />}
                    />
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
