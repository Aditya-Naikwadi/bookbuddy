import { useState } from "react";
import {
  Building2,
  User,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Globe,
  Phone,
  School,
  GraduationCap,
  Laptop,
} from "lucide-react";

const INSTITUTION_TYPES = [
  { key: "university", label: "University", icon: Building2, emoji: "🏛️" },
  { key: "college", label: "College", icon: School, emoji: "🏫" },
  { key: "institute", label: "Tech Institute", icon: Laptop, emoji: "🔬" },
  {
    key: "academy",
    label: "Academy / School",
    icon: GraduationCap,
    emoji: "🎓",
  },
];

const ADMIN_ROLES = [
  { key: "head_librarian", label: "Head / Chief Librarian", emoji: "📖" },
  { key: "campus_admin", label: "Campus Administrator", emoji: "🛡️" },
  { key: "academic_dean", label: "Dean of Academics", emoji: "🎓" },
  { key: "it_director", label: "IT & Systems Director", emoji: "💻" },
];

export default function CollegeAdminOnboardingWizard({
  initialProfile,
  onComplete,
}) {
  const [step, setStep] = useState(1);

  // Micro Data State: Only College & Admin Details
  const [formData, setFormData] = useState({
    // College Info
    collegeName: initialProfile?.name || "",
    domain: initialProfile?.domain || "",
    institutionType: "university",

    // Admin Info
    adminName: initialProfile?.adminName || "",
    adminRole: "head_librarian",
    phone: initialProfile?.contactPhone || "",
  });

  const handleDomainAutoFill = (name) => {
    if (!name) return "";
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return `${clean.slice(0, 15)}.edu`;
  };

  const handleCollegeNameChange = (val) => {
    setFormData((prev) => ({
      ...prev,
      collegeName: val,
      domain: prev.domain || handleDomainAutoFill(val),
    }));
  };

  const handleNextStep1 = (e) => {
    e.preventDefault();
    if (!formData.collegeName.trim()) return;
    setStep(2);
  };

  const handleFinishStep2 = (e) => {
    e.preventDefault();
    if (!formData.adminName.trim()) return;
    setStep(3);
  };

  const handleFinalLaunch = () => {
    onComplete({
      name: formData.collegeName,
      domain: formData.domain || "campus.edu",
      institutionType: formData.institutionType,
      adminName: formData.adminName,
      adminRole: formData.adminRole,
      contactPhone: formData.phone,
      enabledFeatures: [
        "catalog",
        "patrons",
        "loans",
        "fines",
        "e-resources",
        "reading-lists",
      ],
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 font-sans text-slate-900">
      {/* Friendly Top Header */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Quick 30-Second Setup</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Welcome to BookBuddy Campus!
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Let’s personalize your library portal. Just two quick details to get
          started.
        </p>

        {/* Friendly Micro Progress Dots */}
        <div className="flex items-center justify-center gap-3 pt-4">
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold transition-all ${
              step >= 1 ? "text-indigo-600" : "text-slate-400"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 1
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              1
            </span>
            <span>College</span>
          </div>

          <div
            className={`w-8 h-0.5 ${step >= 2 ? "bg-indigo-600" : "bg-slate-200"}`}
          />

          <div
            className={`flex items-center gap-1.5 text-xs font-semibold transition-all ${
              step >= 2 ? "text-indigo-600" : "text-slate-400"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 2
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              2
            </span>
            <span>Admin</span>
          </div>

          <div
            className={`w-8 h-0.5 ${step >= 3 ? "bg-indigo-600" : "bg-slate-200"}`}
          />

          <div
            className={`flex items-center gap-1.5 text-xs font-semibold transition-all ${
              step === 3 ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 3
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              ✓
            </span>
            <span>Launch</span>
          </div>
        </div>
      </div>

      {/* CARD STEP 1: COLLEGE INFO */}
      {step === 1 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden text-slate-900">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600" />

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl">
              🏛️
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Tell us about your Institution
              </h2>
              <p className="text-xs text-slate-500">
                What is the official name of your campus?
              </p>
            </div>
          </div>

          <form onSubmit={handleNextStep1} className="space-y-6">
            {/* Institution Name Input */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
                College / Institution Full Name{" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.collegeName}
                onChange={(e) => handleCollegeNameChange(e.target.value)}
                placeholder="e.g. Stanford University"
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 shadow-xs"
                required
                autoFocus
              />
            </div>

            {/* Institution Type Interactive Chips */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-2.5">
                Select Institution Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {INSTITUTION_TYPES.map((item) => {
                  const isSelected = formData.institutionType === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, institutionType: item.key })
                      }
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col items-center justify-center gap-1.5 text-center ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-lg">{item.emoji}</span>
                      <span className="text-xs font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email Domain */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
                Official Campus Email Domain
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-4 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value })
                  }
                  placeholder="e.g. stanford.edu"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-xs"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Students with emails ending in this domain will be auto-approved for your campus.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={!formData.collegeName.trim()}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all shadow-xs disabled:opacity-40"
              >
                <span>Continue to Admin Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CARD STEP 2: ADMIN DETAILS */}
      {step === 2 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden text-slate-900">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600" />

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl">
              👤
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Primary Librarian / Administrator
              </h2>
              <p className="text-xs text-slate-500">
                Who will manage library operations for {formData.collegeName}?
              </p>
            </div>
          </div>

          <form onSubmit={handleFinishStep2} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
                Administrator Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={formData.adminName}
                  onChange={(e) =>
                    setFormData({ ...formData, adminName: e.target.value })
                  }
                  placeholder="e.g. Dr. Eleanor Vance"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-xs"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
                Designation / Role Title
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ADMIN_ROLES.map((role) => {
                  const isSelected = formData.adminRole === role.key;
                  return (
                    <button
                      key={role.key}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, adminRole: role.key })
                      }
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-lg">{role.emoji}</span>
                      <span className="text-xs font-semibold">{role.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
                Contact Telephone (Optional)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-4 top-3.5 text-slate-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+1 (555) 019-2834"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-xs"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={!formData.adminName.trim()}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all shadow-xs disabled:opacity-40"
              >
                <span>Review & Confirm</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CARD STEP 3: SUMMARY & LAUNCH */}
      {step === 3 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-slate-900 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl border border-emerald-100">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900">
              Ready to Launch {formData.collegeName}!
            </h2>
            <p className="text-xs text-slate-500">
              Your institutional library space is configured and ready.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-left text-xs space-y-3">
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Institution Name:</span>
              <span className="font-semibold text-slate-900">{formData.collegeName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Domain:</span>
              <span className="font-semibold text-indigo-600">{formData.domain}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Administrator:</span>
              <span className="font-semibold text-slate-900">{formData.adminName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Provisioned Modules:</span>
              <span className="font-semibold text-emerald-700">All 6 Core Modules</span>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-xl"
            >
              Modify Details
            </button>
            <button
              onClick={handleFinalLaunch}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Campus Library</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
