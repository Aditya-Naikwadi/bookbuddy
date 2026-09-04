import { ShieldAlert, ArrowLeft, Home, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

const Unauthorized = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const getDashboardPath = () => {
    if (!user) return "/auth/login";
    if (user.role === "super-admin") return "/admin-portal";
    if (user.role === "college-admin") return "/college-admin";
    if (user.role === "general") return "/general-dashboard";
    return "/student-dashboard";
  };

  const handleSwitchAccount = async () => {
    await logout();
    navigate("/auth/login", { replace: true });
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            403 — Access Denied
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            You are currently signed in as a{" "}
            <strong className="text-slate-200">{user?.role || "Guest"}</strong>{" "}
            user, which does not have permission to view this page.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5 justify-center">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </button>

            <button
              onClick={() => navigate(getDashboardPath())}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>My Dashboard</span>
            </button>
          </div>

          <button
            onClick={handleSwitchAccount}
            className="w-full px-4 py-2.5 bg-slate-800/80 hover:bg-slate-800 text-rose-400 hover:text-rose-300 text-xs font-semibold rounded-xl border border-slate-700/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign In with Different Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
