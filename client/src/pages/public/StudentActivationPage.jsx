import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2,
  KeyRound,
  Building2,
} from "lucide-react";
import useAuthStore from "../../store/authStore";

export default function StudentActivationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { checkAuth } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError(
          "Activation token is missing from the link. Please check your activation email.",
        );
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const res = await fetch(
          `/api/v1/auth/activate/verify?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(
            data.message || "Invalid or expired activation link.",
          );
        }

        setStudentInfo(data.student);
      } catch (err) {
        setError(err.message || "Failed to verify activation token.");
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await fetch("/api/v1/auth/activate/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Account activation failed.");
      }

      if (data.token) {
        localStorage.setItem("accessToken", data.token);
        await checkAuth();
      }

      setActivationSuccess(true);
      setTimeout(() => {
        navigate("/student-dashboard");
      }, 2500);
    } catch (err) {
      setError(err.message || "Failed to activate account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">
          Verifying activation token...
        </p>
      </div>
    );
  }

  if (error && !studentInfo && !activationSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">
            Activation Failed
          </h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">{error}</p>
          <Link
            to="/auth/login"
            className="inline-block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition"
          >
            Go to Login Page
          </Link>
        </div>
      </div>
    );
  }

  if (activationSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">
            Account Activated!
          </h2>
          <p className="text-slate-300 text-sm mb-6">
            Your password has been saved. Redirecting to your student
            dashboard...
          </p>
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-lg w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              BookBuddy Account Activation
            </h1>
            <p className="text-xs text-indigo-400 font-medium">
              Single-Use Secure Password Setup
            </p>
          </div>
        </div>

        {studentInfo?.college && (
          <div className="mb-6 p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-400 shrink-0" />
            <div className="text-left">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                College
              </p>
              <p className="text-sm font-bold text-slate-200">
                {studentInfo.college.name}
              </p>
            </div>
          </div>
        )}

        {studentInfo && (
          <div className="mb-6 p-4 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl text-left space-y-1 text-xs text-slate-300">
            <p>
              <span className="text-slate-400">Student Name:</span>{" "}
              <strong className="text-slate-100">{studentInfo.name}</strong>
            </p>
            <p>
              <span className="text-slate-400">Student ID / Roll No:</span>{" "}
              <strong className="text-indigo-300">
                {studentInfo.studentId}
              </strong>
            </p>
            <p>
              <span className="text-slate-400">Email:</span>{" "}
              <strong className="text-slate-100">{studentInfo.email}</strong>
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 8 characters"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none transition"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Activating Account...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Set Password & Activate</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
