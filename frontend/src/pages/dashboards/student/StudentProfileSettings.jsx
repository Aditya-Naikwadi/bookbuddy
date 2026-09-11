import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  Lock,
  CreditCard,
  ShieldCheck,
  Building2,
  GraduationCap,
  Ticket,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import apiClient from "../../../api/client";
import useAuthStore from "../../../store/authStore";
import { toast } from "../../../store/toastStore";
import { PatronCardContainer } from "../../../components/student/patron-card/PatronCardContainer";

export const StudentProfileSettings = () => {
  const { user: authUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState("profile");

  // Fetch full patron profile from /api/v1/auth/profile
  const { data: profileData } = useQuery({
    queryKey: ["student-profile"],
    queryFn: async () => {
      const { data } = await apiClient.get("/auth/profile");
      return data.data;
    },
  });

  const profile = profileData || authUser || {};
  const college = profile.collegeId || {};

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isMatch = newPassword && newPassword === confirmPassword;
  const isStrong = hasMinLength && hasLetter && hasNumber;
  const canSubmitPassword =
    currentPassword && isStrong && isMatch && !isSubmitting;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmitPassword) return;

    setIsSubmitting(true);
    setPasswordError("");

    try {
      const { data } = await apiClient.post("/auth/change-password", {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      // Clear password form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Update auth store user if needed
      useAuthStore.setState((state) => ({
        user: state.user
          ? {
              ...state.user,
              mustChangePasswordOnNextLogin: false,
              status: "active",
            }
          : state.user,
      }));

      toast.success(
        "Password Updated",
        data.message || "Your password has been changed successfully.",
      );
    } catch (err) {
      setPasswordError(
        err.response?.data?.message ||
          "Failed to update password. Please verify your current password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-4">
      {/* Page Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
              Patron Profile & Security
            </span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">
            Profile & Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your institutional credentials, library privileges, password,
            and digital pass.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "profile"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <User
              size={15}
              className={
                activeTab === "profile"
                  ? "text-indigo-600 dark:text-indigo-400"
                  : ""
              }
            />
            <span>Patron Details</span>
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "security"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Lock
              size={15}
              className={
                activeTab === "security"
                  ? "text-indigo-600 dark:text-indigo-400"
                  : ""
              }
            />
            <span>Password & Security</span>
          </button>
          <button
            onClick={() => setActiveTab("card")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "card"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <CreditCard
              size={15}
              className={
                activeTab === "card"
                  ? "text-indigo-600 dark:text-indigo-400"
                  : ""
              }
            />
            <span>Digital Library Pass</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PATRON DETAILS */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {/* Identity Summary Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-serif font-black shadow-lg shrink-0 border-2 border-indigo-400/30">
                  {profile.name ? profile.name.charAt(0).toUpperCase() : "S"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-white">
                      {profile.name || "Student Patron"}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {profile.status === "active"
                        ? "Active Patron"
                        : profile.status || "Active"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                    <Building2 size={13} className="text-indigo-400" />
                    <span>{college.name || "Institutional Member"}</span>
                  </p>
                </div>
              </div>

              {/* Fine Waiver Coupons Badge */}
              <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl w-full sm:w-auto shrink-0 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Ticket size={20} />
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-300">
                    Fine Waiver Coupons
                  </span>
                  <span className="text-lg font-serif font-black text-amber-300">
                    {profile.fineWaiverCoupons || 0} available
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Data Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Academic Information */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <GraduationCap
                  size={16}
                  className="text-indigo-600 dark:text-indigo-400"
                />
                <span>Academic & Institutional Profile</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">
                    Student Roll / ID:
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {profile.studentId || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">
                    Program / Major:
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {profile.program || profile.major || "Undergraduate"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">
                    Academic Year:
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {profile.year || "Current Year"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">
                    Institution:
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {college.name || "Default Campus"}{" "}
                    {college.code ? `(${college.code})` : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Status & Contact */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <ShieldCheck
                  size={16}
                  className="text-indigo-600 dark:text-indigo-400"
                />
                <span>Account & Verification Privileges</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">
                    Email Address:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {profile.email || "Not specified"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">
                    Email Verified:
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={13} /> Verified
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">
                    Account Type:
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white uppercase">
                    {profile.role || "student"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">
                    Circulation Standing:
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    Good Standing
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY & PASSWORD */}
      {activeTab === "security" && (
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                Change Password
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Update your login password. Your new password must be at least 8
                characters long.
              </p>
            </div>
          </div>

          {passwordError && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Current Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                >
                  {showCurrent ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters (letters & numbers)"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Password Validation Checklist */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <span
                  className={`text-[11px] flex items-center gap-1.5 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> At least 8 characters
                </span>
                <span
                  className={`text-[11px] flex items-center gap-1.5 ${hasLetter && hasNumber ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Letters & numbers
                </span>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              {confirmPassword && !isMatch && (
                <p className="text-[11px] text-red-500 font-medium pt-0.5">
                  Passwords do not match.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmitPassword}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: DIGITAL LIBRARY PASS */}
      {activeTab === "card" && (
        <div className="space-y-6 max-w-xl mx-auto">
          <div className="text-center">
            <h2 className="text-xl font-serif font-bold text-slate-900 dark:text-white">
              Digital Patron Card
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Present this barcode at checkout desks or scan the QR code at
              self-service kiosks.
            </p>
          </div>
          <PatronCardContainer />
        </div>
      )}
    </div>
  );
};

export default StudentProfileSettings;
