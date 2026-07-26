import { useState } from "react";
import {
  Building2,
  User,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Globe,
  Phone,
  BookOpen,
  School,
  GraduationCap,
  Award,
  Crown,
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
    <div className="max-w-2xl mx-auto py-6 px-4 font-sans text-slate-100">
      {/* Friendly Top Header */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Quick 30-Second Setup</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Welcome to BookBuddy Campus!
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          Let’s personalize your library portal. Just two quick details to get
          started.
        </p>

        {/* Friendly Micro Progress Dots */}
        <div className="flex items-center justify-center gap-3 pt-4">
          <div
            className={`flex items-center gap-1.5 text-xs font-mono font-bold transition-all ${
              step >= 1 ? "text-indigo-400" : "text-slate-600"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step >= 1
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              1
            </span>
            <span>College</span>
          </div>

          <div
            className={`w-8 h-0.5 ${step >= 2 ? "bg-indigo-500" : "bg-slate-800"}`}
          />

          <div
            className={`flex items-center gap-1.5 text-xs font-mono font-bold transition-all ${
              step >= 2 ? "text-indigo-400" : "text-slate-600"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step >= 2
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              2
            </span>
            <span>Admin</span>
          </div>

          <div
            className={`w-8 h-0.5 ${step >= 3 ? "bg-indigo-500" : "bg-slate-800"}`}
          />

          <div
            className={`flex items-center gap-1.5 text-xs font-mono font-bold transition-all ${
              step === 3 ? "text-emerald-400" : "text-slate-600"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === 3
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-slate-500"
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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600" />

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xl">
              🏛️
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Tell us about your Institution
              </h2>
              <p className="text-xs text-slate-400">
                What is the official name of your campus?
              </p>
            </div>
          </div>

          <form onSubmit={handleNextStep1} className="space-y-6">
            {/* Institution Name Input */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-2">
                College / Institution Full Name{" "}
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.collegeName}
                onChange={(e) => handleCollegeNameChange(e.target.value)}
                placeholder="e.g. Stanford University"
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
                required
                autoFocus
              />
            </div>

            {/* Institution Type Interactive Chips */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-2.5">
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
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30 scale-105"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <span className="text-lg">{item.emoji}</span>
                      <span className="text-xs font-bold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email Domain */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-2">
                Official Campus Email Domain
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-4 top-3.5 text-slate-500" />
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value })
                  }
                  placeholder="stanford.edu"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-800 bg-slate-950 text-indigo-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Used to verify student self-registration (e.g. student@
                <span className="text-indigo-400">
                  {formData.domain || "college.edu"}
                </span>
                ).
              </p>
            </div>

            <button
              type="submit"
              disabled={!formData.collegeName.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <span>Next: Add Admin Profile</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* CARD STEP 2: ADMIN INFO */}
      {step === 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 to-indigo-600" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xl">
                👤
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Who is managing the Library?
                </h2>
                <p className="text-xs text-slate-400">
                  Enter administrator details for {formData.collegeName}.
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep(1)}
              className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>

          <form onSubmit={handleFinishStep2} className="space-y-6">
            {/* Admin Full Name */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-2">
                Administrator Full Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-4 text-slate-500" />
                <input
                  type="text"
                  value={formData.adminName}
                  onChange={(e) =>
                    setFormData({ ...formData, adminName: e.target.value })
                  }
                  placeholder="e.g. Dr. Eleanor Vance"
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-800 bg-slate-950 text-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-600"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Admin Role Chips */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-2.5">
                Your Official Designation
              </label>
              <div className="grid grid-cols-2 gap-2.5">
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
                          ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/30"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <span className="text-lg">{role.emoji}</span>
                      <span className="text-xs font-bold">{role.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-slate-300 mb-2">
                Direct Contact Phone / Extension
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-4 top-3.5 text-slate-500" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+1 (650) 555-0199"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-800 bg-slate-950 text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!formData.adminName.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-purple-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <span>Complete Setup & Summary</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* CARD STEP 3: CELEBRATION SUMMARY */}
      {step === 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-white">
              Your Campus Portal is Ready!
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              We have configured your institution and administrator credentials.
            </p>
          </div>

          {/* Quick Summary Cards */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 text-left space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Institution:</span>
              <span className="font-bold text-white">
                {formData.collegeName}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Domain:</span>
              <span className="text-indigo-400">@{formData.domain}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Administrator:</span>
              <span className="font-bold text-emerald-400">
                {formData.adminName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Designation:</span>
              <span className="text-slate-300 uppercase">
                {formData.adminRole.replace("_", " ")}
              </span>
            </div>
          </div>

          <button
            onClick={handleFinalLaunch}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <span>Launch College Admin Dashboard</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      )}
    </div>
  );
}
