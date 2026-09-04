import { useState } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  Sliders,
  Users,
  BookOpen,
  Receipt,
  FileText,
  Monitor,
  HelpCircle,
  BarChart3,
  Layers,
  ArrowRight,
  Package,
  ShieldCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useAuthStore from "../../../store/authStore";
import featureApi from "../../../api/featureApi";
import collegeAdminApi from "../../../api/collegeAdminApi";
import { getEnabledFeaturesList } from "../../../config/featureRegistry";
import CollegeAdminOnboardingWizard from "../../../components/admin/CollegeAdminOnboardingWizard";

export default function CollegeAdminDashboardHome() {
  const { user, updateUser } = useAuthStore();

  // Fetch Feature Config
  const { data: configData } = useQuery({
    queryKey: ["myCollegeConfig", user?.collegeId],
    queryFn: () => featureApi.getCollegeFeatures(),
    enabled: !!user,
  });

  // Fetch Analytics Summary Metrics
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["collegeAdminAnalyticsSummary", user?.collegeId],
    queryFn: () => collegeAdminApi.getAnalyticsSummary(),
    enabled: !!user,
  });

  const metrics = summaryData?.data || summaryData || {};

  const rawFeatures = configData?.enabledFeatures ||
    user?.collegeProfile?.enabledFeatures ||
    user?.enabledFeatures || [
      "catalog",
      "patrons",
      "loans",
      "fines",
      "e-resources",
      "reading-lists",
    ];

  const collegeProfile = {
    name:
      configData?.college?.name ||
      user?.collegeProfile?.name ||
      user?.collegeName ||
      "Campus Library System",
    shortName:
      configData?.college?.shortName ||
      user?.collegeProfile?.shortName ||
      "Campus",
    slug: configData?.college?.slug || user?.collegeProfile?.slug || "college",
    enabledFeatures: rawFeatures,
  };

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const enabledIds = getEnabledFeaturesList(collegeProfile.enabledFeatures);

  const handleOnboardingComplete = (updatedData) => {
    const updatedProfile = {
      ...collegeProfile,
      name: updatedData.profile.name,
      shortName: updatedData.profile.shortName,
      domain: updatedData.profile.domain,
      enabledFeatures: updatedData.enabledFeatures,
    };

    updateUser({
      ...user,
      collegeProfile: updatedProfile,
    });
    setIsOnboardingOpen(false);
  };

  if (isOnboardingOpen) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        <CollegeAdminOnboardingWizard
          initialProfile={collegeProfile}
          onComplete={handleOnboardingComplete}
        />
      </div>
    );
  }

  const modules = [
    {
      id: "features",
      name: "Feature Module Settings",
      path: "/college-admin/features",
      icon: <Sliders className="w-6 h-6 text-indigo-400" />,
      badge: `${enabledIds.length} Active Modules`,
      description:
        "Enable or disable functional modules, adjust borrow duration policies, max limits, and fine rates.",
    },
    {
      id: "patrons",
      name: "Patron Roster & Accounts",
      path: "/college-admin/patrons",
      icon: <Users className="w-6 h-6 text-emerald-400" />,
      badge: `${(metrics.totalStudents || 0).toLocaleString()} Patrons`,
      description:
        "Student and faculty account management, single enrollment, and borrowing privileges.",
    },
    {
      id: "bulk-upload",
      name: "Bulk Patron CSV Upload",
      path: "/college-admin/bulk-upload",
      icon: <UploadCloud className="w-6 h-6 text-emerald-400" />,
      badge: "ROSTER INGESTION",
      description:
        "Batch import student rosters using CSV/Excel templates with header validation and preview flow.",
    },
    {
      id: "circulation",
      name: "Circulation & Hold Desk",
      path: "/college-admin/circulation",
      icon: <BookOpen className="w-6 h-6 text-blue-400" />,
      badge: `${metrics.activeLoans || 0} Loans Active`,
      description:
        "Counter checkouts, returns processing with automatic fine calculation, and reservation hold queues.",
    },
    {
      id: "cataloging",
      name: "Cataloging & Metadata Desk",
      path: "/college-admin/cataloging",
      icon: <Package className="w-6 h-6 text-amber-400" />,
      badge: `${(metrics.catalogSize || 0).toLocaleString()} Titles`,
      description:
        "Add new books via ISBN Google Books auto-fill or manual entry, and manage total/available copy counts.",
    },
    {
      id: "inventory",
      name: "Branch & Inventory Overview",
      path: "/college-admin/inventory",
      icon: <Layers className="w-6 h-6 text-cyan-400" />,
      badge: `${metrics.stockAlerts?.length || 0} Stock Alerts`,
      description:
        "Physical stock distribution, low-stock warnings, and subject categorization metrics.",
    },
    {
      id: "digital-assets",
      name: "Digital Assets & Moderation",
      path: "/college-admin/digital-assets",
      icon: <FileText className="w-6 h-6 text-purple-400" />,
      badge: `${metrics.digitalResourceCount || 0} E-Resources`,
      description:
        "Upload campus digital assets, e-books, research PDFs, and moderate student upload submissions.",
    },
    {
      id: "finances",
      name: "Finances & Fine Collections",
      path: "/college-admin/finances",
      icon: <Receipt className="w-6 h-6 text-rose-400" />,
      badge: `₹${metrics.unpaidFinesTotal || 0} Unpaid`,
      description:
        "Track overdue fines, log manual cash settlements at counter, and record fee waivers with audit logs.",
    },
    {
      id: "facilities",
      name: "Facilities & Lab Seat Desk",
      path: "/college-admin/facilities",
      icon: <Monitor className="w-6 h-6 text-teal-400" />,
      badge: `${Math.round((metrics.labUtilizationRate || 0) * 100)}% Utilization`,
      description:
        "Configure study lab seats, manage computer hardware specs, and monitor patron seat reservations.",
    },
    {
      id: "helpdesk",
      name: "Helpdesk & Patron Feedback",
      path: "/college-admin/helpdesk",
      icon: <HelpCircle className="w-6 h-6 text-rose-400" />,
      badge: "HELPDESK & FEEDBACK",
      description:
        "Resolve patron support complaints, review student book purchase recommendations, and track feedback logs.",
    },
    {
      id: "analytics",
      name: "Campus Usage Analytics",
      path: "/college-admin/analytics",
      icon: <BarChart3 className="w-6 h-6 text-indigo-400" />,
      badge: "ANALYTICS & REPORTS",
      description:
        "Circulation volume trends, top borrowed books leaderboard, and department utilization metrics.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Top Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full">
              CAMPUS LIBRARY COMMAND CENTER
            </span>
            <span className="text-xs text-slate-500">
              Slug: /{collegeProfile.slug}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-serif">
            {collegeProfile.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl font-sans">
            Tenant Management Portal —{" "}
            <span className="font-mono text-indigo-300 font-bold">
              {enabledIds.length}
            </span>{" "}
            active functional modules provisioned
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => setIsOnboardingOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-200 font-bold text-xs flex items-center gap-2 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Re-run Onboarding Wizard</span>
          </button>
        </div>
      </div>

      {/* Metric Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-bold">
            Enrolled Students
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {isSummaryLoading
              ? "..."
              : (metrics.totalStudents || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-400 mt-1">
            Active Patron Accounts
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-bold">
            Catalog Holdings
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {isSummaryLoading
              ? "..."
              : (metrics.catalogSize || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-indigo-400 mt-1">
            Physical Shelf Titles
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-bold">
            Active Circulation
          </div>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">
            {isSummaryLoading ? "..." : metrics.activeLoans || 0}
          </div>
          <div className="text-[10px] text-amber-400/80 mt-1">
            Books Checked Out
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-bold">
            Outstanding Fines
          </div>
          <div className="text-2xl font-extrabold text-rose-400 mt-1">
            ₹{isSummaryLoading ? "..." : metrics.unpaidFinesTotal || 0}
          </div>
          <div className="text-[10px] text-rose-400/80 mt-1">
            Pending Fine Ledger
          </div>
        </div>
      </div>

      {/* Module Navigation Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Campus Management Modules ({modules.length})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod) => (
            <Link
              key={mod.id}
              to={mod.path}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between transition-all hover:-translate-y-1 hover:border-indigo-500/50 shadow-lg group"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl group-hover:scale-105 transition-transform">
                    {mod.icon}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {mod.badge}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                  {mod.name}
                </h3>
                <p className="text-xs font-sans text-slate-400 mt-2 leading-relaxed">
                  {mod.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-end">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform">
                  Open Desk <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
