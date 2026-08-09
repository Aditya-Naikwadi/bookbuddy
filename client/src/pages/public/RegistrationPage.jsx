import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  User,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Library,
  Receipt,
  IdCard,
  FileText,
  Bookmark,
  Sparkles,
  Heart,
  Layout,
  HelpCircle,
  Trophy,
  Check,
} from "lucide-react";
import registrationApi from "../../api/registrationApi";
import { fetchCsrfToken } from "../../api/client";

const ALL_STUDENT_FEATURES = [
  {
    id: "catalog",
    name: "Book Catalog & Discovery",
    description: "Search & discover physical/digital books.",
    icon: BookOpen,
  },
  {
    id: "loans",
    name: "Book Borrowing & Loans",
    description: "Check out books & request renewals.",
    icon: Library,
  },
  {
    id: "fines",
    name: "Fine & Fee Management",
    description: "View overdue fines & process payments.",
    icon: Receipt,
  },
  {
    id: "patron-card",
    name: "Digital Patron ID Card",
    description: "Digital pass with QR entrance check-in.",
    icon: IdCard,
  },
  {
    id: "e-resources",
    name: "E-Resources & E-Books",
    description: "Read academic PDFs & e-journals online.",
    icon: FileText,
  },
  {
    id: "reading-lists",
    name: "Curated Reading Lists",
    description: "Access syllabus reading lists by faculty.",
    icon: Bookmark,
  },
  {
    id: "recommendations",
    name: "Smart AI Recommendations",
    description: "Personalized book suggestions for students.",
    icon: Sparkles,
  },
  {
    id: "saved",
    name: "Saved Bookmarks & Shelf",
    description: "Save favorite books & bookmark pages.",
    icon: Heart,
  },
  {
    id: "facilities",
    name: "Lab & Study Desk Booking",
    description: "Reserve study desks & research labs.",
    icon: Layout,
  },
  {
    id: "support",
    name: "Help & Support Desk",
    description: "Submit support tickets & librarian inquiries.",
    icon: HelpCircle,
  },
  {
    id: "gamification",
    name: "Gamification & Badges",
    description: "Track streaks, earn badges & leaderboards.",
    icon: Trophy,
  },
];

export default function RegistrationPage() {
  const navigate = useNavigate();

  // General feedback messages
  const [globalMessage, setGlobalMessage] = useState({ type: "", text: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // College Admin Registration State (Step 1: Admin & College details, Step 2: Feature selection)
  const [adminWizardStep, setAdminWizardStep] = useState(1);
  const [adminForm, setAdminForm] = useState({
    collegeName: "",
    collegeEmail: "",
    adminName: "",
    adminEmail: "",
    password: "",
    confirmPassword: "",
    isCollegeAdminConfirmed: false,
  });
  const [selectedFeatures, setSelectedFeatures] = useState(
    ALL_STUDENT_FEATURES.map((f) => f.id),
  );

  useEffect(() => {
    fetchCsrfToken();
  }, []);

  // Step 1 Validation (ONLY the 6 requested questions!)
  const handleAdminStep1Next = (e) => {
    e.preventDefault();
    setFieldErrors({});
    setGlobalMessage({ type: "", text: "" });

    if (!adminForm.collegeName.trim()) {
      setGlobalMessage({ type: "error", text: "Please enter College Name." });
      return;
    }
    if (!adminForm.collegeEmail.trim()) {
      setGlobalMessage({ type: "error", text: "Please enter College Email." });
      return;
    }
    if (!adminForm.adminName.trim()) {
      setGlobalMessage({
        type: "error",
        text: "Please enter College Admin Name.",
      });
      return;
    }
    if (!adminForm.adminEmail.trim()) {
      setGlobalMessage({
        type: "error",
        text: "Please enter College Admin Email.",
      });
      return;
    }
    if (!adminForm.password) {
      setGlobalMessage({ type: "error", text: "Please enter a Password." });
      return;
    }
    if (adminForm.password !== adminForm.confirmPassword) {
      setGlobalMessage({ type: "error", text: "Passwords do not match." });
      return;
    }
    if (!adminForm.isCollegeAdminConfirmed) {
      setGlobalMessage({
        type: "error",
        text: "Please confirm that you are a College Administrator (not a student).",
      });
      return;
    }

    setAdminWizardStep(2);
  };

  // Final Submission (Feature Selection Step)
  const handleAdminFinalSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    setGlobalMessage({ type: "", text: "" });

    if (selectedFeatures.length === 0) {
      setGlobalMessage({
        type: "error",
        text: "Please select at least one feature provided to Students.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("collegeName", adminForm.collegeName);
      formData.append("collegeEmail", adminForm.collegeEmail);
      formData.append("adminName", adminForm.adminName);
      formData.append("adminEmail", adminForm.adminEmail);
      formData.append("password", adminForm.password);
      formData.append("confirmPassword", adminForm.confirmPassword);
      formData.append("selectedServices", JSON.stringify(selectedFeatures));

      await registrationApi.submitTenantOnboarding(formData);

      setGlobalMessage({
        type: "success",
        text: "College Admin application submitted successfully!",
      });
      setAdminWizardStep(3); // Success state
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.errors && typeof resp.errors === "object") {
        setFieldErrors(resp.errors);
      } else {
        setGlobalMessage({
          type: "error",
          text: resp?.message || "Failed to submit College Admin registration.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-3 sm:p-4">
      <div className="max-w-3xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700 p-4 sm:p-6 space-y-3">
        {/* Compact Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                BookBuddy College Admin Registration
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Onboard your institution & configure student library features.
              </p>
            </div>
          </div>

          <Link
            to="/auth/login"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
          >
            Sign In →
          </Link>
        </div>

        {/* Global Alert Notification */}
        {globalMessage.text && (
          <div
            className={`p-2.5 rounded-xl flex items-center gap-2 text-xs font-medium ${
              globalMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
            }`}
          >
            {globalMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{globalMessage.text}</span>
          </div>
        )}

        {/* Prominent Warning Banner explicitly preventing students from filling this form */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-amber-800 dark:text-amber-300 flex items-center gap-2 text-xs font-medium">
          <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            <strong>COLLEGE ADMIN ONLY:</strong> This form must be filled out by
            College Administrators only.{" "}
            <strong>Students must NOT fill this form.</strong>
          </span>
        </div>

        {adminWizardStep === 1 ? (
          /* STEP 1: Compact Grid with ONLY the 6 requested questions! */
          <form onSubmit={handleAdminStep1Next} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Question 1: College Name */}
              <div>
                <label htmlFor="reg-college-name" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  1. College Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="reg-college-name"
                    name="collegeName"
                    type="text"
                    value={adminForm.collegeName}
                    onChange={(e) =>
                      setAdminForm({
                        ...adminForm,
                        collegeName: e.target.value,
                      })
                    }
                    placeholder="e.g. Stanford University"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                    required
                  />
                </div>
              </div>

              {/* Question 2: College Email */}
              <div>
                <label htmlFor="reg-college-email" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  2. College Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="reg-college-email"
                    name="collegeEmail"
                    type="email"
                    value={adminForm.collegeEmail}
                    onChange={(e) =>
                      setAdminForm({
                        ...adminForm,
                        collegeEmail: e.target.value,
                      })
                    }
                    placeholder="e.g. info@stanford.edu"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                    required
                  />
                </div>
              </div>

              {/* Question 3: College Admin Name */}
              <div>
                <label htmlFor="reg-admin-name" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  3. College Admin Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="reg-admin-name"
                    name="adminName"
                    type="text"
                    value={adminForm.adminName}
                    onChange={(e) =>
                      setAdminForm({ ...adminForm, adminName: e.target.value })
                    }
                    placeholder="e.g. Dr. Eleanor Vance"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                    required
                  />
                </div>
              </div>

              {/* Question 4: College Admin Email */}
              <div>
                <label htmlFor="reg-admin-email" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  4. College Admin Email{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="reg-admin-email"
                    name="adminEmail"
                    type="email"
                    value={adminForm.adminEmail}
                    onChange={(e) =>
                      setAdminForm({ ...adminForm, adminEmail: e.target.value })
                    }
                    placeholder="e.g. admin@stanford.edu"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                    required
                  />
                </div>
                {fieldErrors.adminEmail && (
                  <p className="text-[10px] text-rose-500 mt-0.5">
                    {fieldErrors.adminEmail}
                  </p>
                )}
              </div>

              {/* Question 5: Password */}
              <div>
                <label htmlFor="reg-admin-password" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  5. Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="reg-admin-password"
                    name="password"
                    type="password"
                    value={adminForm.password}
                    onChange={(e) =>
                      setAdminForm({ ...adminForm, password: e.target.value })
                    }
                    placeholder="Min 8 characters"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                    required
                  />
                </div>
                {fieldErrors.password && (
                  <p className="text-[10px] text-rose-500 mt-0.5">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Question 6: Confirm Password */}
              <div>
                <label htmlFor="reg-admin-confirm-password" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  6. Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    id="reg-admin-confirm-password"
                    name="confirmPassword"
                    type="password"
                    value={adminForm.confirmPassword}
                    onChange={(e) =>
                      setAdminForm({
                        ...adminForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="Repeat password"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Role Confirmation Checkbox */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                id="isAdminConfirmation"
                name="isAdminConfirmation"
                checked={adminForm.isCollegeAdminConfirmed}
                onChange={(e) =>
                  setAdminForm({
                    ...adminForm,
                    isCollegeAdminConfirmed: e.target.checked,
                  })
                }
                className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 rounded border-slate-300 cursor-pointer"
                required
              />
              <label
                htmlFor="isAdminConfirmation"
                className="text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
              >
                I confirm that I am a <strong>College Administrator</strong>{" "}
                (not a student).
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span>Next: Select Student Features</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : adminWizardStep === 2 ? (
          /* STEP 2: Choose Features provided to Students in the application */
          <form onSubmit={handleAdminFinalSubmit} className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Step 2: Choose Features Provided to Students
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Enable student features for{" "}
                  <strong>{adminForm.collegeName}</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAdminWizardStep(1)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </div>

            {/* Select All / Deselect All Bar */}
            <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 text-[11px]">
              <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                {selectedFeatures.length} of {ALL_STUDENT_FEATURES.length}{" "}
                Features Selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedFeatures(ALL_STUDENT_FEATURES.map((f) => f.id))
                  }
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedFeatures([])}
                  className="font-bold text-slate-600 dark:text-slate-400 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Compact Feature Grid (Fits Single Page) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {ALL_STUDENT_FEATURES.map((feat) => {
                const isChecked = selectedFeatures.includes(feat.id);
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.id}
                    onClick={() => {
                      if (isChecked) {
                        setSelectedFeatures(
                          selectedFeatures.filter((id) => id !== feat.id),
                        );
                      } else {
                        setSelectedFeatures([...selectedFeatures, feat.id]);
                      }
                    }}
                    className={`p-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-2 ${
                      isChecked
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        isChecked
                          ? "bg-indigo-600 text-white"
                          : "border border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-1">
                        <Icon
                          className={`w-3.5 h-3.5 ${isChecked ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"}`}
                        />
                        <span className="font-bold text-[11px] text-slate-900 dark:text-white leading-tight">
                          {feat.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || selectedFeatures.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                "Submitting Application..."
              ) : (
                <>
                  <span>Complete & Submit Application</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* STEP 3: Success Screen */
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Registration Submitted & Pending Review
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Your onboarding request for{" "}
                <strong>{adminForm.collegeName}</strong> has been submitted successfully and is currently under review by Super Admin.
              </p>
              <p className="text-[11px] text-indigo-500 dark:text-indigo-400 mt-2 font-medium">
                Applications are typically reviewed within 24 hours. An approval email will be sent to <strong>{adminForm.adminEmail}</strong> upon activation.
              </p>
            </div>

            <button
              onClick={() => navigate("/auth/login")}
              className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all inline-flex items-center gap-2"
            >
              <span>Return to Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
