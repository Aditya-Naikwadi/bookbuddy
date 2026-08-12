import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  Building2,
  FileCheck,
  ShieldAlert,
  RefreshCw,
  Server,
  Lock,
  Terminal,
  LogOut,
  Layers,
} from "lucide-react";
import useAuthStore from "../../store/authStore";
import OpsSeverityBadge from "./OpsSeverityBadge";

export function OpsHeader({ title, subtitle, onRefresh, isRefreshing }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [timeUtc, setTimeUtc] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeUtc(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      path: "/admin-portal/overview",
      label: "System Overview",
      code: "MODULE_01",
      icon: Activity,
    },
    {
      path: "/admin-portal/college-admins",
      label: "Tenant Provisioning",
      code: "MODULE_02",
      icon: Building2,
    },
    {
      path: "/admin-portal/moderation",
      label: "E-Resource Moderation",
      code: "MODULE_03",
      icon: FileCheck,
    },
    {
      path: "/admin-portal/audit-logs",
      label: "Security Audit Logs",
      code: "MODULE_04",
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="bg-slate-950 border-b border-slate-800/80 sticky top-0 z-30 shadow-2xl">
      {/* Top Technical Operations Ribbon */}
      <div className="bg-slate-900/90 border-b border-slate-800/60 px-4 py-1.5 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span className="tracking-wider uppercase">
              BookBuddy Ops Plane
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            <span>ENV: PRODUCTION // US-EAST-1</span>
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="hidden sm:inline text-slate-400">{timeUtc}</span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <OpsSeverityBadge
            status="healthy"
            label="ALL SYSTEMS OPERATIONAL"
            size="sm"
          />
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-bold flex items-center gap-1">
            <Lock className="w-3 h-3 text-indigo-400" />
            <span>{user?.email || "superadmin@bookbuddy.app"}</span>
          </span>
          <button
            onClick={() => logout()}
            className="text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 hover:underline"
            title="Terminate session"
          >
            <LogOut className="w-3 h-3" />
            <span>Exit Ops</span>
          </button>
        </div>
      </div>

      {/* Primary Ops Navigation & Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                Super Admin Control Console
              </span>
              {location.pathname === "/admin-portal/registration-queue" && (
                <span className="text-[10px] font-mono uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  Pending Onboardings Gate
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-mono font-extrabold text-white tracking-tight mt-1">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all hover:border-slate-600 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-indigo-400 ${isRefreshing ? "animate-spin" : ""}`}
                />
                <span>{isRefreshing ? "SYNCING..." : "RE-SYNC OPS"}</span>
              </button>
            )}

            <Link
              to="/admin-portal/registration-queue"
              className="px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-200 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Review Queue Gate</span>
            </Link>
          </div>
        </div>

        {/* 4-Module Operations Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto mt-4 pt-2 border-t border-slate-800/80 scrollbar-none">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all shrink-0 border ${
                  isActive
                    ? "bg-slate-900 text-indigo-300 border-indigo-500/80 shadow-lg shadow-indigo-950/50"
                    : "bg-slate-950 text-slate-400 border-transparent hover:bg-slate-900 hover:text-slate-200 hover:border-slate-800"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-slate-500"}`}
                />
                <span>{item.label}</span>
                <span className="text-[9px] text-slate-600 font-mono">
                  [{item.code}]
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default OpsHeader;
