import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  FileCheck,
  ShieldCheck,
  RefreshCw,
  LogOut,
  User,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import useAuthStore from "../../store/authStore";

export function OpsHeader({ title, subtitle, onRefresh, isRefreshing }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [timeString, setTimeString] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      path: "/admin-portal/overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      path: "/admin-portal/college-admins",
      label: "Tenants & Institutions",
      icon: Building2,
    },
    {
      path: "/admin-portal/moderation",
      label: "Content Moderation",
      icon: FileCheck,
    },
    {
      path: "/admin-portal/audit-logs",
      label: "Security Audit Trail",
      icon: ShieldCheck,
    },
  ];

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs font-sans">
      {/* Top Utility Ribbon */}
      <div className="bg-slate-900 text-slate-300 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/admin-portal/overview"
            className="flex items-center gap-2 font-bold text-white hover:text-indigo-300 transition-colors"
          >
            <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs font-black">
              B
            </div>
            <span className="font-semibold text-sm tracking-tight">
              BookBuddy Platform Admin
            </span>
          </Link>
          <span className="text-slate-700">|</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span className="font-medium text-slate-300">All Systems Operational</span>
          </span>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <span className="hidden sm:inline text-slate-400">{timeString}</span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 text-xs">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium text-slate-200 truncate max-w-[200px]">
              {user?.email || "superadmin@bookbuddy.com"}
            </span>
            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
              Super Admin
            </span>
          </div>
          <button
            onClick={() => logout()}
            className="text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 text-xs font-medium px-2 py-1 rounded hover:bg-slate-800"
            title="Sign out of administration console"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Page Title & Primary Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                Administration Portal
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 max-w-3xl leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-xs hover:border-slate-300 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-indigo-600 ${isRefreshing ? "animate-spin" : ""}`}
                />
                <span>{isRefreshing ? "Syncing..." : "Sync Data"}</span>
              </button>
            )}

            <Link
              to="/admin-portal/registration-queue"
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-xs"
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Pending Onboardings</span>
            </Link>
          </div>
        </div>

        {/* Clean Enterprise Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto mt-4 pt-3 border-t border-slate-100 scrollbar-none">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 border ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200/80 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200/60 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export default OpsHeader;

