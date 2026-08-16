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

  const tiles = [
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
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <OpsHeader
        title="Platform Administration Console"
        subtitle="Global management center for multi-tenant colleges, system security, user permissions, and infrastructure oversight"
        onRefresh={refetch}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Status Alert Banner */}
        {totalPendingActionItems > 0 ? (
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <OpsSeverityBadge
                    status="warning"
                    label={`${totalPendingActionItems} Action Items Pending`}
                    size="sm"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
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
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs"
                >
                  Review Requests ({pendingOnboardings})
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <OpsSeverityBadge
                    status="healthy"
                    label="All Systems Nominal"
                    size="sm"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Zero Pending Bottlenecks
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  All onboarding applications, content moderation submissions,
                  and support requests are currently up to date.
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline-block">
              Platform Status: Healthy
            </span>
          </div>
        )}

        {/* Enterprise KPI Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Campus Tenants
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {isLoading ? "..." : totalColleges}
            </div>
            <div className="text-xs font-medium text-indigo-600 mt-1">
              Active Institutions
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Accounts
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {isLoading ? "..." : totalUsers.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-emerald-600 mt-1">
              Cross-Tenant Directory
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Actions
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {isLoading ? "..." : totalPendingActionItems}
            </div>
            <div className="text-xs font-medium text-amber-700 mt-1">
              Tasks Awaiting Review
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Loans
            </div>
            <div className="text-2xl font-bold text-cyan-600 mt-1">
              {isLoading ? "..." : activeLoans}
            </div>
            <div className="text-xs font-medium text-cyan-700 mt-1">
              Monitored Circulation
            </div>
          </div>
        </div>

        {/* Module Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiles.map((tile) => (
            <Link
              key={tile.id}
              to={tile.path}
              className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200 group shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                      {tile.icon}
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                        {tile.subtitle}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mt-0.5">
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

                <p className="text-xs text-slate-500 leading-relaxed mb-4 font-normal">
                  {tile.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  {isLoading ? "Loading..." : tile.countLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
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
