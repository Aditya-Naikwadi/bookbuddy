import { useMemo } from "react";
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
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import OpsHeader from "../../../components/ops/OpsHeader";
import OpsSeverityBadge from "../../../components/ops/OpsSeverityBadge";
import { useAdminOverview } from "../../../hooks/useAdminOverview";

export default function AdminDashboardHome() {
  const {
    overview,
    isLoading,
    isError: _isError,
    refetch,
  } = useAdminOverview();

  const pendingOnboardings = overview?.pendingOnboardingCount || 0;
  const pendingModerations = overview?.pendingModerationCount || 0;
  const openTickets = overview?.unresolvedSupportCount || 0;
  const totalColleges = overview?.totalColleges || 0;
  const totalUsers = overview?.totalUsers || 0;
  const activeLoans = overview?.activeLoans || 0;

  const totalPendingActionItems =
    pendingOnboardings + pendingModerations + openTickets;

  const tiles = useMemo(
    () => [
      {
        id: "overview",
        title: "System Infrastructure & Health",
        subtitle: "Cluster Telemetry & Metrics",
        path: "/admin-portal/overview",
        icon: <Globe className="w-5 h-5 text-indigo-600" />,
        countLabel: overview
          ? `${totalColleges} Active Institutions`
          : "Loading...",
        badgeStatus: "healthy",
        badgeText: "Operational",
        description:
          "Real-time infrastructure health, database memory, cron job execution logs, and feature adoption rates.",
      },
      {
        id: "users",
        title: "User Directory & Access Control",
        subtitle: "Global RBAC & Identity",
        path: "/admin-portal/users",
        icon: <Users className="w-5 h-5 text-emerald-600" />,
        countLabel: overview
          ? `${totalUsers.toLocaleString()} Registered Users`
          : "Loading...",
        badgeStatus: "info",
        badgeText: "Directory Active",
        description:
          "Manage platform-wide user accounts, update security roles, toggle access statuses, and manage user impersonation.",
      },
      {
        id: "colleges",
        title: "Tenants & College Administrators",
        subtitle: "Tenant Provisioning & Setup",
        path: "/admin-portal/college-admins",
        icon: <Building className="w-5 h-5 text-blue-600" />,
        countLabel: overview
          ? `${overview?.userCountsByRole?.["college-admin"] || 0} Admin Accounts`
          : "Loading...",
        badgeStatus: "info",
        badgeText: `${totalColleges} Provisioned`,
        description:
          "Provision new college tenants, configure custom institution subdomains, and assign college librarians & administrators.",
      },
      {
        id: "registration-queue",
        title: "Onboarding Review Queue",
        subtitle: "Tenant Approvals",
        path: "/admin-portal/registration-queue",
        icon: <FileCheck className="w-5 h-5 text-amber-600" />,
        countLabel: `${pendingOnboardings} Pending Request(s)`,
        badgeStatus: pendingOnboardings > 0 ? "warning" : "healthy",
        badgeText:
          pendingOnboardings > 0
            ? `${pendingOnboardings} Pending Approval`
            : "Queue Clear",
        description:
          "Review and approve self-service institution registration requests and verify uploaded accreditation documents.",
      },
      {
        id: "moderation",
        title: "Global Content Moderation",
        subtitle: "E-Resource Compliance",
        path: "/admin-portal/moderation",
        icon: <Shield className="w-5 h-5 text-purple-600" />,
        countLabel: `${pendingModerations} Pending Material(s)`,
        badgeStatus: pendingModerations > 0 ? "warning" : "healthy",
        badgeText:
          pendingModerations > 0
            ? `${pendingModerations} Pending Review`
            : "Queue Clear",
        description:
          "Review uploaded digital e-books, open-access research papers, and educational resources before publishing.",
      },
      {
        id: "data-oversight",
        title: "Global Circulation & Fines",
        subtitle: "Platform Data Analytics",
        path: "/admin-portal/data-oversight",
        icon: <Layers className="w-5 h-5 text-cyan-600" />,
        countLabel: overview
          ? `${activeLoans} Active Loans · ₹${overview?.totalUnpaidFineAmount || 0} Fines`
          : "Loading...",
        badgeStatus: "info",
        badgeText: "Live Metrics",
        description:
          "Cross-institutional cataloging overview, active book loan statistics, fine collection tracking, and circulation analytics.",
      },
      {
        id: "support",
        title: "Helpdesk & Escalations",
        subtitle: "Support Tickets",
        path: "/admin-portal/support",
        icon: <HelpCircle className="w-5 h-5 text-rose-600" />,
        countLabel: `${openTickets} Open Ticket(s)`,
        badgeStatus: openTickets > 0 ? "warning" : "healthy",
        badgeText:
          openTickets > 0 ? `${openTickets} Open Ticket(s)` : "No Escalations",
        description:
          "Centralized support management queue for technical support tickets, patron inquiries, and system complaints.",
      },
      {
        id: "audit-logs",
        title: "Security Audit Trail",
        subtitle: "System Event Stream",
        path: "/admin-portal/audit-logs",
        icon: <FileSearch className="w-5 h-5 text-teal-600" />,
        countLabel: overview
          ? `${(overview?.auditLogsCount || 0).toLocaleString()} Recorded Events`
          : "Loading...",
        badgeStatus: "healthy",
        badgeText: "Audit Log Active",
        description:
          "Immutable audit logs tracking system state changes, role adjustments, tenant creation, and administrative events.",
      },
      {
        id: "settings",
        title: "System Settings & Maintenance",
        subtitle: "Configuration & Backups",
        path: "/admin-portal/settings",
        icon: <HardDrive className="w-5 h-5 text-slate-600" />,
        countLabel: "System Ready · Backups Ok",
        badgeStatus: "healthy",
        badgeText: "Configured",
        description:
          "Manage environment configuration, default borrowing rules, rate limiting options, SMTP settings, and database backups.",
      },
    ],
    [
      overview,
      totalColleges,
      totalUsers,
      pendingOnboardings,
      pendingModerations,
      openTickets,
      activeLoans,
    ],
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-void text-slate-900 dark:text-ink font-sans pb-12">
      <OpsHeader
        title="Platform Administration Console"
        subtitle="Global management center for multi-tenant colleges, system security, user permissions, and infrastructure oversight"
        onRefresh={refetch}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Status Alert Banner */}
        {isLoading ? (
          <div className="admin-glass-card h-20 skeleton-shimmer rounded-2xl" />
        ) : totalPendingActionItems > 0 ? (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <OpsSeverityBadge
                    status="warning"
                    label={`${totalPendingActionItems} Action Items Pending`}
                    size="sm"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-ink">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-muted mt-1">
                  {pendingOnboardings} onboarding request(s),{" "}
                  {pendingModerations} content moderation item(s), and{" "}
                  {openTickets} open support ticket(s) require review.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pendingOnboardings > 0 && (
                <Link
                  to="/admin-portal/registration-queue"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md hover:shadow-amber-500/20 active:scale-95"
                >
                  Review Requests ({pendingOnboardings})
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="admin-glass-card p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <OpsSeverityBadge
                    status="healthy"
                    label="All Systems Nominal"
                    size="sm"
                  />
                  <span className="text-xs font-semibold text-slate-900 dark:text-ink">
                    Zero Pending Bottlenecks
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-muted mt-0.5">
                  All onboarding applications, content moderation submissions,
                  and support requests are currently up to date.
                </p>
              </div>
            </div>
            <span className="text-xs text-emerald-400 font-medium hidden sm:inline-block border border-emerald-500/30 px-3 py-1 rounded-full bg-emerald-500/10">
              Platform Status: Healthy
            </span>
          </div>
        )}

        {/* Enterprise KPI Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`kpi-skel-${idx}`}
                className="admin-stat-card h-28 skeleton-shimmer"
              />
            ))
          ) : (
            <>
              <div className="admin-stat-card">
                <div className="text-[11px] font-semibold text-slate-400 dark:text-muted uppercase tracking-wider">
                  Campus Tenants
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-ink mt-1 tracking-tight">
                  {totalColleges}
                </div>
                <div className="text-xs font-medium text-indigo-500 dark:text-indigo-400 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span>Active Institutions</span>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="text-[11px] font-semibold text-slate-400 dark:text-muted uppercase tracking-wider">
                  Total Accounts
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-ink mt-1 tracking-tight">
                  {totalUsers.toLocaleString()}
                </div>
                <div className="text-xs font-medium text-emerald-500 dark:text-emerald-400 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Cross-Tenant Directory</span>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="text-[11px] font-semibold text-slate-400 dark:text-muted uppercase tracking-wider">
                  Pending Actions
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-500 dark:text-amber-400 mt-1 tracking-tight">
                  {totalPendingActionItems}
                </div>
                <div className="text-xs font-medium text-amber-600 dark:text-amber-300 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Tasks Awaiting Review</span>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="text-[11px] font-semibold text-slate-400 dark:text-muted uppercase tracking-wider">
                  Active Loans
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-cyan-500 dark:text-cyan-400 mt-1 tracking-tight">
                  {activeLoans}
                </div>
                <div className="text-xs font-medium text-cyan-600 dark:text-cyan-300 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  <span>Monitored Circulation</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Module Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tiles.map((tile) => (
            <Link
              key={tile.id}
              to={tile.path}
              className="admin-glass-card admin-glass-card-hover flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-surface/80 border border-white/10 group-hover:border-ember/40 group-hover:bg-ember/10 transition-all">
                      {tile.icon}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-muted block uppercase tracking-wider">
                        {tile.subtitle}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-ink group-hover:text-ember transition-colors mt-0.5">
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

                <p className="text-xs text-slate-500 dark:text-muted leading-relaxed mb-4 font-normal">
                  {tile.description}
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-400 dark:text-slate-400">
                  {isLoading ? "Loading..." : tile.countLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 font-bold text-indigo-500 dark:text-indigo-400 group-hover:text-ember group-hover:translate-x-1 transition-all">
                  <span>Open Module</span>
                  <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
