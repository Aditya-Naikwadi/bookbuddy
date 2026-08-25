import { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Book,
  LayoutDashboard,
  Search,
  LogOut,
  Bookmark,
  FileText,
  X,
  Globe,
  FileCheck,
  HardDrive,
} from "lucide-react";

import NotificationCenter from "../components/student/NotificationCenter";
import ThemeToggle from "../components/common/ThemeToggle";
import useAuthStore from "../store/authStore";
import { useFeatureFlags } from "../hooks/useFeatureFlags";
import { motion, AnimatePresence } from "framer-motion";
import {
  STUDENT_NAV_ITEMS,
  COLLEGE_ADMIN_NAV_ITEMS,
  SUPER_ADMIN_NAV_ITEMS,
  GENERAL_NAV_ITEMS,
} from "../config/navigation";
import { cn } from "../utils/cn";

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(location.pathname);
  const mainContentRef = useRef(null);

  // Problem 2 Task 4: Reset main content scroll position to top on route change
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

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
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-void text-slate-900 dark:text-ink flex flex-col md:flex-row transition-colors duration-200">
      {/* Desktop Sidebar (Visible on >= md) */}
      <aside className="w-full md:w-64 bg-white dark:bg-surface border-r border-slate-200 dark:border-edge flex-shrink-0 flex-col hidden md:flex h-full z-30 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-edge flex items-center gap-2 flex-shrink-0">
          <Book className="text-indigo-600 dark:text-ember w-8 h-8" />
          <span className="text-2xl font-serif font-bold text-slate-900 dark:text-ink">
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
                Administrator
              </p>
              {SUPER_ADMIN_NAV_ITEMS.map((item) => {
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
              {GENERAL_NAV_ITEMS.map((item) => {
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
        <div className="p-4 border-t border-slate-200 dark:border-edge flex-shrink-0 bg-white dark:bg-surface">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 w-full p-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-ember transition-colors font-medium rounded-xl hover:bg-indigo-50/60 dark:hover:bg-slate-800/60"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content & Topbar (Independent Scroll Region) */}
      <main
        ref={mainContentRef}
        className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto scrollbar-thin pb-16 md:pb-0"
      >
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-surface border-b border-slate-200 dark:border-edge flex items-center justify-between px-4 sm:px-6 z-20 transition-colors duration-200">
          <div className="flex items-center gap-3">
            {/* Mobile/Tablet Hamburger Toggle */}
            <button
              className="hamburger-button md:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-expanded={mobileMenuOpen}
              aria-controls="dashboard-mobile-drawer"
              aria-label={
                mobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              <span className="hamburger-line hamburger-line-1 !bg-slate-700 dark:!bg-slate-200" />
              <span className="hamburger-line hamburger-line-2 !bg-slate-700 dark:!bg-slate-200" />
              <span className="hamburger-line hamburger-line-3 !bg-slate-700 dark:!bg-slate-200" />
            </button>

            <Link to="/" className="flex items-center gap-2 md:hidden">
              <Book className="text-indigo-600 dark:text-ember w-6 h-6" />
              <span className="text-lg font-serif font-bold text-slate-900 dark:text-ink">
                BookBuddy
              </span>
            </Link>
          </div>

          <div className="flex-1 max-w-xl hidden md:block mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search global books & catalog..."
                aria-label="Search global books and catalog"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-deep border border-slate-200 dark:border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-ember text-slate-900 dark:text-ink text-sm placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <ThemeToggle />
            <NotificationCenter />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-indigo-700 dark:text-ember font-bold uppercase text-xs">
                {user?.name?.substring(0, 2) || "U"}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content with Smooth Route Transition */}
        <div className="p-4 sm:p-6 flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="min-h-full flex flex-col"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile/Tablet Backdrop Overlay */}
      <div
        className={cn(
          "nav-drawer-overlay md:hidden",
          mobileMenuOpen && "is-open",
        )}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Mobile/Tablet Navigation Drawer Panel */}
      <aside
        id="dashboard-mobile-drawer"
        className={cn(
          "nav-drawer-panel md:hidden !bg-white !text-slate-900 border-l border-slate-200 shadow-2xl",
          mobileMenuOpen && "is-open",
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
                Administrator
              </p>
              {SUPER_ADMIN_NAV_ITEMS.map((item) => {
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

          {isCollegeAdmin && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                College Admin
              </p>
              <NavItem
                to="/college-admin"
                icon={<LayoutDashboard size={20} />}
                label="Dashboard Home"
              />
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
              {GENERAL_NAV_ITEMS.map((item) => {
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

          {isStudent && (
            <>
              <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Student Features
              </p>
              <NavItem
                to="/student-dashboard"
                icon={<LayoutDashboard size={20} />}
                label="Dashboard Home"
              />
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
            <MobileNavItem
              to="/general-dashboard"
              icon={<LayoutDashboard size={20} />}
              label="Home"
            />
            <MobileNavItem
              to="/general-dashboard/search"
              icon={<Search size={20} />}
              label="Search"
            />
            <MobileNavItem
              to="/general-dashboard/e-resources"
              icon={<FileText size={20} />}
              label="Resources"
            />
            <MobileNavItem
              to="/general-dashboard/saved"
              icon={<Bookmark size={20} />}
              label="Saved"
            />
          </>
        ) : isStudent ? (
          <>
            <MobileNavItem
              to="/student-dashboard"
              icon={<LayoutDashboard size={20} />}
              label="Home"
            />
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
            <MobileNavItem
              to="/college-admin"
              icon={<LayoutDashboard size={20} />}
              label="Home"
            />
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
            <MobileNavItem
              to="/admin-portal"
              icon={<LayoutDashboard size={20} />}
              label="Home"
            />
            <MobileNavItem
              to="/admin-portal/overview"
              icon={<Globe size={20} />}
              label="Overview"
            />
            <MobileNavItem
              to="/admin-portal/moderation"
              icon={<FileCheck size={20} />}
              label="Moderation"
            />
            <MobileNavItem
              to="/admin-portal/settings"
              icon={<HardDrive size={20} />}
              label="Settings"
            />
          </>
        )}
      </nav>
    </div>
  );
}

const NavItem = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive =
    location.pathname === to ||
    (to !== "/admin-portal" && location.pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all text-xs",
        isActive
          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800/60 shadow-xs"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-ink",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
};

const MobileNavItem = ({ to, icon, label }) => (
  <Link
    to={to}
    className="flex flex-col items-center gap-1 text-slate-600 hover:text-indigo-600 text-xs font-medium"
  >
    {icon}
    <span>{label}</span>
  </Link>
);
