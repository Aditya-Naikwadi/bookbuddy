import { useState, useEffect, useCallback } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
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
  X,
} from "lucide-react";
import NotificationCenter from "../components/student/NotificationCenter";
import useAuthStore from "../store/authStore";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import {
  STUDENT_NAV_ITEMS,
  COLLEGE_ADMIN_NAV_ITEMS,
} from "../config/navigation";
import { cn } from "../utils/cn";

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(location.pathname);

  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }

  const { isFeatureEnabled } = useFeatureFlags();

  const isAdminPortal = user?.role === "super-admin";
  const isCollegeAdmin = user?.role === "college-admin";
  const isGeneralDashboard = user?.role === "general";
  const isStudent = user?.role === "student";

  const visibleStudentItems = STUDENT_NAV_ITEMS.filter(
    (item) => !item.feature || isFeatureEnabled(item.feature),
  );

  const visibleCollegeAdminItems = COLLEGE_ADMIN_NAV_ITEMS.filter(
    (item) => !item.feature || isFeatureEnabled(item.feature),
  );

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const closeMenu = useCallback(() => setMobileMenuOpen(false), []);

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        closeMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen, closeMenu]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar (Visible on >= md) */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex-col hidden md:flex md:h-screen md:sticky md:top-0 z-30">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
          <Book className="text-indigo-600 w-8 h-8" />
          <span className="text-2xl font-serif font-bold text-slate-900">
            BookBuddy
          </span>
        </div>
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto scrollbar-thin">
          {isAdminPortal && (
            <NavItem
              to="/admin-portal"
              icon={<LayoutDashboard size={20} />}
              label="Admin Portal"
            />
          )}
          {isCollegeAdmin && (
            <NavItem
              to="/college-admin"
              icon={<LayoutDashboard size={20} />}
              label="College Admin"
            />
          )}
          {isStudent && (
            <NavItem
              to="/student-dashboard"
              icon={<LayoutDashboard size={20} />}
              label="Student Dashboard"
            />
          )}
          {isGeneralDashboard && (
            <NavItem
              to="/general-dashboard"
              icon={<LayoutDashboard size={20} />}
              label="General Dashboard"
            />
          )}

          <div className="my-4 border-t border-slate-100"></div>

          {isAdminPortal && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Super Admin
              </p>
              <NavItem
                to="/admin-portal/overview"
                icon={<Globe size={20} />}
                label="System Overview"
              />
              <NavItem
                to="/admin-portal/college-admins"
                icon={<Shield size={20} />}
                label="College Admins"
              />
              <NavItem
                to="/admin-portal/moderation"
                icon={<FileCheck size={20} />}
                label="Content Moderation"
              />
              <NavItem
                to="/admin-portal/audit-logs"
                icon={<FileSearch size={20} />}
                label="Audit Logs"
              />
              <NavItem
                to="/admin-portal/settings"
                icon={<HardDrive size={20} />}
                label="System Settings"
              />
            </>
          )}

          {isCollegeAdmin && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                College Admin
              </p>
              {visibleCollegeAdminItems
                .filter((item) => item.key !== "dashboard")
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
              <NavItem
                to="/general-dashboard/search"
                icon={<Search size={20} />}
                label="Advanced Search"
              />
              <NavItem
                to="/general-dashboard/e-resources"
                icon={<FileText size={20} />}
                label="Public E-Resources"
              />
              <NavItem
                to="/general-dashboard/saved"
                icon={<Bookmark size={20} />}
                label="Saved Bookmarks"
              />
            </>
          )}

          {isStudent && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Student Features
              </p>
              {visibleStudentItems
                .filter((item) => item.key !== "dashboard")
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
        <div className="p-4 border-t border-slate-200 flex-shrink-0 bg-white">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 w-full p-2 text-slate-600 hover:text-indigo-600 transition-colors font-medium rounded-xl hover:bg-indigo-50/60"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content & Topbar */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile/Tablet Hamburger Toggle */}
            <button
              className="hamburger-button md:hidden hover:bg-slate-100"
              aria-expanded={mobileMenuOpen}
              aria-controls="dashboard-mobile-drawer"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              <span className="hamburger-line hamburger-line-1 !bg-slate-700" />
              <span className="hamburger-line hamburger-line-2 !bg-slate-700" />
              <span className="hamburger-line hamburger-line-3 !bg-slate-700" />
            </button>

            <Link to="/" className="flex items-center gap-2 md:hidden">
              <Book className="text-indigo-600 w-6 h-6" />
              <span className="text-lg font-serif font-bold text-slate-900">
                BookBuddy
              </span>
            </Link>
          </div>

          <div className="flex-1 max-w-xl hidden md:block mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search catalog..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 ml-auto">
            <NotificationCenter />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold uppercase text-xs">
                {user?.name?.substring(0, 2) || "U"}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile/Tablet Backdrop Overlay */}
      <div
        className={cn("nav-drawer-overlay md:hidden", mobileMenuOpen && "is-open")}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Mobile/Tablet Navigation Drawer Panel */}
      <aside
        id="dashboard-mobile-drawer"
        className={cn(
          "nav-drawer-panel md:hidden !bg-white !text-slate-900 border-l border-slate-200 shadow-2xl",
          mobileMenuOpen && "is-open"
        )}
        aria-label="Dashboard navigation menu"
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Book className="text-indigo-600 w-6 h-6" />
            <span className="text-xl font-serif font-bold text-slate-900">
              BookBuddy
            </span>
          </div>
          <button
            onClick={closeMenu}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
          {isAdminPortal && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Super Admin
              </p>
              <NavItem to="/admin-portal" icon={<LayoutDashboard size={20} />} label="Admin Dashboard" />
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
              <NavItem to="/college-admin" icon={<LayoutDashboard size={20} />} label="Dashboard Home" />
              {visibleCollegeAdminItems
                .filter((item) => item.key !== "dashboard")
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
                General Public Portal
              </p>
              <NavItem to="/general-dashboard" icon={<LayoutDashboard size={20} />} label="Portal Overview" />
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
              <NavItem to="/student-dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard Home" />
              {visibleStudentItems
                .filter((item) => item.key !== "dashboard")
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

        <div className="pt-4 border-t border-slate-100 mt-auto">
          <button
            onClick={() => {
              closeMenu();
              logout();
            }}
            className="flex items-center gap-3 w-full p-2.5 text-slate-600 hover:text-indigo-600 transition-colors font-medium rounded-xl hover:bg-indigo-50/60"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-40 shadow-lg">
        {isGeneralDashboard ? (
          <>
            <MobileNavItem to="/general-dashboard" icon={<LayoutDashboard size={20} />} label="Home" />
            <MobileNavItem to="/general-dashboard/search" icon={<Search size={20} />} label="Search" />
            <MobileNavItem to="/general-dashboard/e-resources" icon={<FileText size={20} />} label="Resources" />
            <MobileNavItem to="/general-dashboard/saved" icon={<Bookmark size={20} />} label="Saved" />
          </>
        ) : isStudent ? (
          <>
            <MobileNavItem to="/student-dashboard" icon={<LayoutDashboard size={20} />} label="Home" />
            {visibleStudentItems.slice(1, 4).map((item) => {
              const IconComp = item.icon;
              return (
                <MobileNavItem
                  key={item.key}
                  to={item.route}
                  icon={<IconComp size={20} />}
                  label={item.label.split(" ")[0]}
                />
              );
            })}
          </>
        ) : isCollegeAdmin ? (
          <>
            <MobileNavItem to="/college-admin" icon={<LayoutDashboard size={20} />} label="Home" />
            {visibleCollegeAdminItems.slice(1, 4).map((item) => {
              const IconComp = item.icon;
              return (
                <MobileNavItem
                  key={item.key}
                  to={item.route}
                  icon={<IconComp size={20} />}
                  label={item.label.split(" ")[0]}
                />
              );
            })}
          </>
        ) : (
          <>
            <MobileNavItem to="/admin-portal" icon={<LayoutDashboard size={20} />} label="Home" />
            <MobileNavItem to="/admin-portal/overview" icon={<Globe size={20} />} label="Overview" />
            <MobileNavItem to="/admin-portal/moderation" icon={<FileCheck size={20} />} label="Moderation" />
            <MobileNavItem to="/admin-portal/settings" icon={<HardDrive size={20} />} label="Settings" />
          </>
        )}
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
