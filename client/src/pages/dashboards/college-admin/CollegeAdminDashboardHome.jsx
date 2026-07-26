import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UploadCloud,
  Settings2,
  Sparkles,
  BookOpen,
  Users,
  Library,
  Receipt,
  FileText,
  ListPlus,
  Monitor,
  Award,
  HelpCircle,
  BarChart3,
  Plus,
  ExternalLink,
  Sliders,
  CheckCircle2,
  Layers,
} from "lucide-react";
import useAuthStore from "../../../store/authStore";
import {
  FEATURE_REGISTRY,
  getEnabledFeaturesList,
} from "../../../config/featureRegistry";
import CollegeAdminOnboardingWizard from "../../../components/admin/CollegeAdminOnboardingWizard";

export default function CollegeAdminDashboardHome() {
  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();

  // College Profile & Features state
  const collegeProfile = user?.collegeProfile || {
    name: user?.collegeName || "Stanford University",
    shortName: "Stanford",
    slug: "stanford-univ",
    enabledFeatures: [
      "catalog",
      "patrons",
      "loans",
      "fines",
      "e-resources",
      "reading-lists",
    ],
    isOnboarded: true,
  };

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(
    !collegeProfile.isOnboarded,
  );
  const enabledIds = getEnabledFeaturesList(collegeProfile.enabledFeatures);

  const [activeModuleTab, setActiveModuleTab] = useState(
    enabledIds[0] || "catalog",
  );

  const handleOnboardingComplete = (updatedData) => {
    const updatedProfile = {
      ...collegeProfile,
      name: updatedData.profile.name,
      shortName: updatedData.profile.shortName,
      domain: updatedData.profile.domain,
      enabledFeatures: updatedData.enabledFeatures,
      isOnboarded: true,
    };

    updateUser({
      ...user,
      collegeProfile: updatedProfile,
    });
    setIsOnboardingOpen(false);
  };

  if (isOnboardingOpen) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <CollegeAdminOnboardingWizard
          initialProfile={collegeProfile}
          onComplete={handleOnboardingComplete}
        />
      </div>
    );
  }

  const activeFeatureObj =
    FEATURE_REGISTRY[activeModuleTab] || FEATURE_REGISTRY.catalog;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Top Identity & Action Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full">
              Multi-Tenant Campus Console
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Slug: /{collegeProfile.slug || "stanford-univ"}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            {collegeProfile.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Custom Provisioned Dashboard — Active Modules:{" "}
            <span className="font-mono text-indigo-300 font-bold">
              {enabledIds.length}
            </span>{" "}
            enabled
          </p>
        </div>

        {/* Header Quick Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/college-admin/bulk-upload"
            className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-200 font-semibold text-xs flex items-center gap-2 transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            <span>Bulk CSV Roster Import</span>
          </Link>

          <Link
            to="/college-admin/features"
            className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-200 font-semibold text-xs flex items-center gap-2 transition-colors"
          >
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Add / Manage Features</span>
          </Link>
        </div>
      </div>

      {/* Dynamic Enabled Modules Tab Bar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Enabled Feature Sections ({enabledIds.length})</span>
          </h2>
          <button
            onClick={() => setIsOnboardingOpen(true)}
            className="text-xs font-mono text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>Re-run Wizard</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
          {enabledIds.map((featId) => {
            const feat = FEATURE_REGISTRY[featId];
            if (!feat) return null;
            const IconComp = feat.icon;
            const isActive = activeModuleTab === featId;

            return (
              <button
                key={featId}
                onClick={() => setActiveModuleTab(featId)}
                className={`px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-2.5 transition-all shrink-0 border ${
                  isActive
                    ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <IconComp className="w-4 h-4" />
                <span>{feat.name}</span>
                {isActive && (
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Feature Operational View Shell */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 min-h-[480px] shadow-xl space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              {activeFeatureObj.icon && (
                <activeFeatureObj.icon className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                  {activeFeatureObj.category}
                </span>
                {activeFeatureObj.isCore && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                    Core Module
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white mt-1">
                {activeFeatureObj.name}
              </h3>
            </div>
          </div>

          <div className="text-xs text-slate-400 max-w-sm sm:text-right">
            {activeFeatureObj.description}
          </div>
        </div>

        {/* Operational Module Content Shell */}
        <ModuleViewShell
          featureId={activeModuleTab}
          collegeName={collegeProfile.name}
        />
      </div>
    </div>
  );
}

// Sub-component rendering operational empty / initial states for each enabled feature
function ModuleViewShell({ featureId, collegeName }) {
  switch (featureId) {
    case "catalog":
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl">
              <p className="text-xs font-mono text-slate-400 uppercase">
                Total Titles
              </p>
              <p className="text-2xl font-bold text-white mt-1">1,240</p>
            </div>
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl">
              <p className="text-xs font-mono text-slate-400 uppercase">
                Available Copies
              </p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">890</p>
            </div>
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl">
              <p className="text-xs font-mono text-slate-400 uppercase">
                Categories
              </p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">24</p>
            </div>
          </div>
          <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center space-y-3 bg-slate-950/40">
            <BookOpen className="w-10 h-10 text-indigo-400 mx-auto" />
            <h4 className="text-base font-bold text-white">
              Central Book Catalog Active
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Scan ISBN barcodes or import catalog MARC entries to populate{" "}
              {collegeName}'s physical book collection.
            </p>
          </div>
        </div>
      );

    case "patrons":
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl">
              <p className="text-xs font-mono text-slate-400 uppercase">
                Active Students
              </p>
              <p className="text-2xl font-bold text-white mt-1">350</p>
            </div>
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl">
              <p className="text-xs font-mono text-slate-400 uppercase">
                Domain Whitelisted
              </p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                Verified
              </p>
            </div>
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl">
              <p className="text-xs font-mono text-slate-400 uppercase">
                Patron Cards Issued
              </p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">328</p>
            </div>
          </div>
          <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center space-y-3 bg-slate-950/40">
            <Users className="w-10 h-10 text-indigo-400 mx-auto" />
            <h4 className="text-base font-bold text-white">
              Patron Digital ID Records
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Manage student roster memberships, issue digital patron cards, and
              enforce roll number validation.
            </p>
          </div>
        </div>
      );

    case "loans":
      return (
        <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center space-y-3 bg-slate-950/40">
          <Library className="w-10 h-10 text-indigo-400 mx-auto" />
          <h4 className="text-base font-bold text-white">
            Circulation & Borrowing Desk
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Process book checkouts, return queues, reserve holds, and automated
            return due reminders.
          </p>
        </div>
      );

    case "fines":
      return (
        <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center space-y-3 bg-slate-950/40">
          <Receipt className="w-10 h-10 text-amber-400 mx-auto" />
          <h4 className="text-base font-bold text-white">
            Fine Management & Fee Ledgers
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Automate daily overdue penalties, track unpaid fine balances, and
            record payment receipts.
          </p>
        </div>
      );

    case "e-resources":
      return (
        <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center space-y-3 bg-slate-950/40">
          <FileText className="w-10 h-10 text-indigo-400 mx-auto" />
          <h4 className="text-base font-bold text-white">
            Digital E-Resources & E-Books
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Upload institutional PDFs, syllabus e-books, and research papers
            accessible via embedded readers.
          </p>
        </div>
      );

    default:
      return (
        <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center space-y-3 bg-slate-950/40">
          <Sparkles className="w-10 h-10 text-indigo-400 mx-auto" />
          <h4 className="text-base font-bold text-white">
            Module Operational State Active
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            This module is enabled and operational for {collegeName}. Staff
            members can perform daily admin tasks.
          </p>
        </div>
      );
  }
}
