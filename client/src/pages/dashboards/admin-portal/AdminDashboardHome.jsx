import { Link } from "react-router-dom";
import {
  Globe,
  Users,
  Building,
  FileCheck,
  Shield,
  Layers,
  HelpCircle,
  FileSearch,
  HardDrive,
  ArrowRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import OpsHeader from "../../../components/ops/OpsHeader";
import OpsSeverityBadge from "../../../components/ops/OpsSeverityBadge";
import { useAdminOverview } from "../../../hooks/useAdminOverview";

export default function AdminDashboardHome() {
  const { overview, isLoading, isError, refetch } = useAdminOverview();

  const pendingOnboardings = overview?.pendingOnboardingCount || 0;
  const pendingModerations = overview?.pendingModerationCount || 0;
  const openTickets = overview?.unresolvedSupportCount || 0;
  const totalColleges = overview?.totalColleges || 0;
  const totalUsers = overview?.totalUsers || 0;
  const activeLoans = overview?.activeLoans || 0;

  const totalPendingActionItems =
    pendingOnboardings + pendingModerations + openTickets;

  const tiles = [
    {
      id: "overview",
      title: "System Overview & Infrastructure",
      subtitle: "MODULE 01 // SYSTEM HEALTH",
      path: "/admin-portal/overview",
      icon: <Globe className="w-6 h-6 text-indigo-400" />,
      countLabel: overview
        ? `${totalColleges} Active Tenants`
        : "Loading Telemetry...",
      badgeStatus: "healthy",
      badgeText: "NOMINAL LATENCY",
      description:
        "Real-time cluster health, memory footprint, background cron status, and feature adoption matrix across institutions.",
      accentBorder: "hover:border-indigo-500/50",
    },
    {
      id: "users",
      title: "User Directory & Impersonation",
      subtitle: "MODULE 02 // IDENTITY & RBAC",
      path: "/admin-portal/users",
      icon: <Users className="w-6 h-6 text-emerald-400" />,
      countLabel: overview
        ? `${totalUsers.toLocaleString()} User Accounts`
        : "Loading Users...",
      badgeStatus: "info",
      badgeText: "CROSS-TENANT DIRECTORY",
      description:
        "Global user directory, role assignments, status toggles, administrative password resets, and 1-click user impersonation.",
      accentBorder: "hover:border-emerald-500/50",
    },
    {
      id: "colleges",
      title: "College Tenants & Admins",
      subtitle: "MODULE 03 // TENANT PROVISIONING",
      path: "/admin-portal/college-admins",
      icon: <Building className="w-6 h-6 text-blue-400" />,
      countLabel: overview
        ? `${overview?.userCountsByRole?.["college-admin"] || 0} Admin Managers`
        : "Loading Tenants...",
      badgeStatus: "info",
      badgeText: `${totalColleges} TENANTS PROVISIONED`,
      description:
        "Multi-tenant management console to provision new colleges, configure domain slugs, and assign institution administrators.",
      accentBorder: "hover:border-blue-500/50",
    },
    {
      id: "registration-queue",
      title: "Onboarding Review Queue",
      subtitle: "MODULE 04 // REGISTRATION GATEWAY",
      path: "/admin-portal/registration-queue",
      icon: <FileCheck className="w-6 h-6 text-amber-400" />,
      countLabel: `${pendingOnboardings} Pending Approval(s)`,
      badgeStatus: pendingOnboardings > 0 ? "warning" : "healthy",
      badgeText:
        pendingOnboardings > 0
          ? `${pendingOnboardings} ACTION REQUIRED`
          : "GATEWAY CLEAR",
      description:
        "Self-service college registration applications pending Super Admin document verification and approval sign-off.",
      accentBorder:
        pendingOnboardings > 0
          ? "border-amber-500/40 hover:border-amber-400"
          : "hover:border-amber-500/50",
    },
    {
      id: "moderation",
      title: "Global Content Moderation",
      subtitle: "MODULE 05 // E-RESOURCE QUALITY",
      path: "/admin-portal/moderation",
      icon: <Shield className="w-6 h-6 text-purple-400" />,
      countLabel: `${pendingModerations} Pending Review(s)`,
      badgeStatus: pendingModerations > 0 ? "warning" : "healthy",
      badgeText:
        pendingModerations > 0
          ? `${pendingModerations} REVIEW QUEUED`
          : "QUEUE CLEAR",
      description:
        "Platform-wide moderation queue for reviewing digital e-resources, research papers, and study material uploads.",
      accentBorder:
        pendingModerations > 0
          ? "border-purple-500/40 hover:border-purple-400"
          : "hover:border-purple-500/50",
    },
    {
      id: "data-oversight",
      title: "Global Data & Circulation",
      subtitle: "MODULE 06 // GLOBAL METRICS",
      path: "/admin-portal/data-oversight",
      icon: <Layers className="w-6 h-6 text-cyan-400" />,
      countLabel: overview
        ? `${activeLoans} Active Loans // ₹${overview?.totalUnpaidFineAmount || 0} Fines`
        : "Loading Data...",
      badgeStatus: "info",
      badgeText: "AGGREGATE METRICS",
      description:
        "Cross-institutional cataloging overview, active loans tracker, fine collection logs, and global circulation analytics.",
      accentBorder: "hover:border-cyan-500/50",
    },
    {
      id: "support",
      title: "Global Support Queue",
      subtitle: "MODULE 07 // HELPDESK & ESCALATIONS",
      path: "/admin-portal/support",
      icon: <HelpCircle className="w-6 h-6 text-rose-400" />,
      countLabel: `${openTickets} Unresolved Ticket(s)`,
      badgeStatus: openTickets > 0 ? "warning" : "healthy",
      badgeText:
        openTickets > 0 ? `${openTickets} TICKETS OPEN` : "ZERO ESCALATIONS",
      description:
        "Centralized support queue for resolving technical complaints, patron grievances, and institutional helpdesk tickets.",
      accentBorder:
        openTickets > 0
          ? "border-rose-500/40 hover:border-rose-400"
          : "hover:border-rose-500/50",
    },
    {
      id: "audit-logs",
      title: "Security Audit Logs",
      subtitle: "MODULE 08 // EVENT STREAM",
      path: "/admin-portal/audit-logs",
      icon: <FileSearch className="w-6 h-6 text-teal-400" />,
      countLabel: overview
        ? `${(overview?.auditLogsCount || 0).toLocaleString()} Events Streamed`
        : "Loading Logs...",
      badgeStatus: "healthy",
      badgeText: "IMMUTABLE AUDIT TRAIL",
      description:
        "Tamper-proof event logs recording system state mutations, role adjustments, tenant provisioning, and security events.",
      accentBorder: "hover:border-teal-500/50",
    },
    {
      id: "settings",
      title: "System Settings & Maintenance",
      subtitle: "MODULE 09 // CONFIG & BACKUPS",
      path: "/admin-portal/settings",
      icon: <HardDrive className="w-6 h-6 text-slate-400" />,
      countLabel: "System Ready // Storage Configured",
      badgeStatus: "healthy",
      badgeText: "MAINTENANCE OK",
      description:
        "Global environment settings, default borrowing rules, rate limit thresholds, SMTP parameters, and manual database backups.",
      accentBorder: "hover:border-slate-500/50",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <OpsHeader
        title="SUPER ADMIN PLATFORM COMMAND CENTER"
        subtitle="Global SaaS operational hub for multi-tenant control, user directory, system security, and infrastructure oversight"
        onRefresh={refetch}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Global Operational Alarm Status */}
        {totalPendingActionItems > 0 ? (
          <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-4 flex items-center justify-between gap-4 font-mono shadow-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
              <div>
                <div className="flex items-center gap-2">
                  <OpsSeverityBadge
                    status="warning"
                    label={`${totalPendingActionItems} PENDING ACTION ITEM(S)`}
                    size="sm"
                  />
                  <span className="text-xs font-bold text-amber-200 uppercase tracking-wide">
                    Super Admin Attention Required
                  </span>
                </div>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  {pendingOnboardings} onboarding application(s),{" "}
                  {pendingModerations} content moderation review(s), and{" "}
                  {openTickets} open support ticket(s) await review.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pendingOnboardings > 0 && (
                <Link
                  to="/admin-portal/registration-queue"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                >
                  Review Onboardings ({pendingOnboardings})
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-xl p-4 flex items-center justify-between gap-4 font-mono shadow-md">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <OpsSeverityBadge
                    status="healthy"
                    label="ALL SYSTEMS NOMINAL"
                    size="sm"
                  />
                  <span className="text-xs font-bold text-emerald-200 uppercase tracking-wide">
                    Zero Pending Approval Bottlenecks
                  </span>
                </div>
                <p className="text-[11px] text-emerald-300/80 mt-0.5">
                  All onboarding queues, moderation queues, and support
                  escalations are currently up to date.
                </p>
              </div>
            </div>
            <span className="text-xs text-emerald-400/80 font-mono">
              PLATFORM MODE: PRODUCTION READY
            </span>
          </div>
        )}

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
              Campus Tenants
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {isLoading ? "..." : totalColleges}
            </div>
            <div className="text-[10px] text-indigo-400 mt-1">
              Active Multi-Tenant Instances
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
              Total Accounts
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {isLoading ? "..." : totalUsers.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-400 mt-1">
              Cross-Tenant Directory
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
              Pending Gates
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {isLoading ? "..." : totalPendingActionItems}
            </div>
            <div className="text-[10px] text-amber-400/80 mt-1">
              Actionable Tasks
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
              Active Circulation
            </div>
            <div className="text-2xl font-bold text-cyan-400 mt-1">
              {isLoading ? "..." : activeLoans}
            </div>
            <div className="text-[10px] text-cyan-400/80 mt-1">
              Loans Monitored
            </div>
          </div>
        </div>

        {/* 9 Admin Navigation Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiles.map((tile) => (
            <Link
              key={tile.id}
              to={tile.path}
              className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 font-mono flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 shadow-lg hover:shadow-2xl group ${tile.accentBorder}`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl group-hover:scale-105 transition-transform">
                      {tile.icon}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                        {tile.subtitle}
                      </span>
                      <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {tile.title}
                      </h3>
                    </div>
                  </div>
                  <OpsSeverityBadge
                    status={tile.badgeStatus}
                    label={tile.badgeText}
                    size="sm"
                  />
                </div>

                <p className="text-xs text-slate-400 font-sans leading-relaxed mb-4">
                  {tile.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  {isLoading ? "Fetching count..." : tile.countLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform">
                  Launch Module <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
