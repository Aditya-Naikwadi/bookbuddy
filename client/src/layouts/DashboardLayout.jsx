import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import {
  Book,
  LayoutDashboard,
  Search,
  Globe,
  Shield,
  FileCheck,
  FileSearch,
  HardDrive,
  LogOut,
  Bookmark,
  FileText,
} from 'lucide-react';
import NotificationCenter from '../components/student/NotificationCenter';
import useAuthStore from '../store/authStore';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import { STUDENT_NAV_ITEMS, COLLEGE_ADMIN_NAV_ITEMS } from '../config/navigation';

const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const { isFeatureEnabled } = useFeatureFlags();

  const isAdminPortal = user?.role === 'super-admin';
  const isCollegeAdmin = user?.role === 'college-admin';
  const isGeneralDashboard = user?.role === 'general';
  const isStudent = user?.role === 'student';

  const visibleStudentItems = STUDENT_NAV_ITEMS.filter(
    (item) => !item.feature || isFeatureEnabled(item.feature)
  );

  const visibleCollegeAdminItems = COLLEGE_ADMIN_NAV_ITEMS.filter(
    (item) => !item.feature || isFeatureEnabled(item.feature)
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <Book className="text-indigo-600 w-8 h-8" />
          <span className="text-2xl font-serif font-bold text-slate-900">BookBuddy</span>
        </div>
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {isAdminPortal && (
            <NavItem to="/admin-portal" icon={<LayoutDashboard size={20} />} label="Admin Portal" />
          )}
          {isCollegeAdmin && (
            <NavItem to="/college-admin" icon={<LayoutDashboard size={20} />} label="College Admin" />
          )}
          {isStudent && (
            <NavItem to="/student-dashboard" icon={<LayoutDashboard size={20} />} label="Student Dashboard" />
          )}
          {isGeneralDashboard && (
            <NavItem to="/general-dashboard" icon={<LayoutDashboard size={20} />} label="General Dashboard" />
          )}

          <div className="my-4 border-t border-slate-100"></div>

          {isAdminPortal && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Super Admin
              </p>
              <NavItem to="/admin-portal/overview" icon={<Globe size={20} />} label="System Overview" />
              <NavItem to="/admin-portal/college-admins" icon={<Shield size={20} />} label="College Admins" />
              <NavItem to="/admin-portal/moderation" icon={<FileCheck size={20} />} label="Content Moderation" />
              <NavItem to="/admin-portal/audit-logs" icon={<FileSearch size={20} />} label="Audit Logs" />
              <NavItem to="/admin-portal/settings" icon={<HardDrive size={20} />} label="System Settings" />
            </>
          )}

          {isCollegeAdmin && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                College Admin
              </p>
              {visibleCollegeAdminItems
                .filter((item) => item.key !== 'dashboard')
                .map((item) => {
                  const IconComp = item.icon;
                  return (
                    <NavItem
                      key={item.key}
                      to={item.route}
                      icon={<IconComp size={20} />}
                      label={item.label}
                    />
                  );
                })}
            </>
          )}

          {isGeneralDashboard && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                General Public
              </p>
              <NavItem to="/general-dashboard/search" icon={<Search size={20} />} label="Advanced Search" />
              <NavItem to="/general-dashboard/e-resources" icon={<FileText size={20} />} label="Public E-Resources" />
              <NavItem to="/general-dashboard/saved" icon={<Bookmark size={20} />} label="Saved Bookmarks" />
            </>
          )}

          {isStudent && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Student Features
              </p>
              {visibleStudentItems
                .filter((item) => item.key !== 'dashboard')
                .map((item) => {
                  const IconComp = item.icon;
                  return (
                    <NavItem
                      key={item.key}
                      to={item.route}
                      icon={<IconComp size={20} />}
                      label={item.label}
                    />
                  );
                })}
            </>
          )}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 w-full p-2 text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex-1 max-w-xl hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search catalog..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <NotificationCenter />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold uppercase">
                {user?.name?.substring(0, 2) || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50">
        <MobileNavItem
          to={
            isAdminPortal
              ? '/admin-portal'
              : isCollegeAdmin
              ? '/college-admin'
              : isGeneralDashboard
              ? '/general-dashboard'
              : '/student-dashboard'
          }
          icon={<LayoutDashboard size={20} />}
          label="Home"
        />
        {isStudent &&
          visibleStudentItems.slice(1, 4).map((item) => {
            const IconComp = item.icon;
            return (
              <MobileNavItem
                key={item.key}
                to={item.route}
                icon={<IconComp size={20} />}
                label={item.label.split(' ')[0]}
              />
            );
          })}
      </nav>
    </div>
  );
};

const NavItem = ({ to, icon, label }) => (
  <Link
    to={to}
    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 font-medium transition-colors"
  >
    {icon}
    {label}
  </Link>
);

const MobileNavItem = ({ to, icon, label }) => (
  <Link
    to={to}
    className="flex flex-col items-center gap-1 text-slate-600 hover:text-indigo-600 text-xs font-medium"
  >
    {icon}
    <span>{label}</span>
  </Link>
);

export default DashboardLayout;
