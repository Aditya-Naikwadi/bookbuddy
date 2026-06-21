import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import AuthLayout from './layouts/AuthLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboardHome from './pages/dashboards/admin-portal/AdminDashboardHome'
import CollegeAdminDashboardHome from './pages/dashboards/college-admin/CollegeAdminDashboardHome'
import StudentDashboardHome from './pages/dashboards/student/StudentDashboardHome'
import GeneralDashboardHome from './pages/dashboards/general/GeneralDashboardHome'

// Student Dashboard Features
import Catalog from './pages/dashboards/student/Catalog'
import MyLoans from './pages/dashboards/student/MyLoans'
import Fines from './pages/dashboards/student/Fines'
import PatronCard from './pages/dashboards/student/PatronCard'
import EResources from './pages/dashboards/student/EResources'
import ReadingLists from './pages/dashboards/student/ReadingLists'
import Recommendations from './pages/dashboards/student/Recommendations'
import SavedBookmarks from './pages/dashboards/student/SavedBookmarks'
import LabBooking from './pages/dashboards/student/LabBooking'
import Support from './pages/dashboards/student/Support'
import EbookReader from './pages/dashboards/student/EbookReader'
// College Admin Dashboard Features
import PatronManagement from './pages/dashboards/college-admin/PatronManagement'
import Circulation from './pages/dashboards/college-admin/Circulation'
import Cataloging from './pages/dashboards/college-admin/Cataloging'
import DigitalAssets from './pages/dashboards/college-admin/DigitalAssets'
import Inventory from './pages/dashboards/college-admin/Inventory'
import Finances from './pages/dashboards/college-admin/Finances'
import SystemConfig from './pages/dashboards/college-admin/SystemConfig'
import Facilities from './pages/dashboards/college-admin/Facilities'
import Helpdesk from './pages/dashboards/college-admin/Helpdesk'
import Analytics from './pages/dashboards/college-admin/Analytics'

// General Dashboard Features
import GeneralSearch from './pages/dashboards/general/GeneralSearch'
import GeneralEResources from './pages/dashboards/general/GeneralEResources'
import GeneralSaved from './pages/dashboards/general/GeneralSaved'

// Admin Portal (Super Admin) Features
import SystemOverview from './pages/dashboards/admin-portal/SystemOverview'
import CollegeAdminManager from './pages/dashboards/admin-portal/CollegeAdminManager'
import GlobalContentModeration from './pages/dashboards/admin-portal/GlobalContentModeration'
import AuditLogs from './pages/dashboards/admin-portal/AuditLogs'
import SystemSettings from './pages/dashboards/admin-portal/SystemSettings'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>

        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/student-dashboard" replace />} />
          
          {/* Dashboard Homes */}
          <Route path="admin-portal" element={<AdminDashboardHome />} />
          <Route path="college-admin" element={<CollegeAdminDashboardHome />} />
          <Route path="student-dashboard" element={<StudentDashboardHome />} />
          <Route path="general-dashboard" element={<GeneralDashboardHome />} />
          <Route path="general-dashboard/search" element={<GeneralSearch />} />
          <Route path="general-dashboard/e-resources" element={<GeneralEResources />} />
          <Route path="general-dashboard/saved" element={<GeneralSaved />} />
          
          {/* Admin Portal (Super Admin) Specific Routes */}
          <Route path="admin-portal/overview" element={<SystemOverview />} />
          <Route path="admin-portal/college-admins" element={<CollegeAdminManager />} />
          <Route path="admin-portal/moderation" element={<GlobalContentModeration />} />
          <Route path="admin-portal/audit-logs" element={<AuditLogs />} />
          <Route path="admin-portal/settings" element={<SystemSettings />} />

          {/* College Admin Specific Routes */}
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

          {/* Student Specific Routes */}
          <Route path="catalog" element={<Catalog />} />
          <Route path="loans" element={<MyLoans />} />
          <Route path="fines" element={<Fines />} />
          <Route path="patron-card" element={<PatronCard />} />
          <Route path="e-resources" element={<EResources />} />
          <Route path="reading-lists" element={<ReadingLists />} />
          <Route path="recommendations" element={<Recommendations />} />
          <Route path="saved" element={<SavedBookmarks />} />
          <Route path="lab-booking" element={<LabBooking />} />
          <Route path="support" element={<Support />} />
        </Route>

        {/* Fullscreen Reader Route */}
        <Route path="/eresources/read/:resourceId" element={<EbookReader />} />
      </Routes>
    </Router>
  )
}

export default App
