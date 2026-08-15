import { AlertOctagon, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

export default function ImpersonationBanner() {
  const { user, isImpersonated, stopImpersonating } = useAuthStore();
  const navigate = useNavigate();

  const originalToken = localStorage.getItem("originalSuperAdminToken");
  if (!isImpersonated && !originalToken) return null;

  const handleExitImpersonation = async () => {
    await stopImpersonating();
    navigate("/admin-portal/users", { replace: true });
  };

  return (
    <div className="bg-amber-600 text-slate-950 px-4 py-2 font-mono text-xs font-bold flex items-center justify-between shadow-md z-50 sticky top-0 border-b border-amber-700">
      <div className="flex items-center gap-2">
        <AlertOctagon className="w-4 h-4 text-slate-950 animate-pulse" />
        <span>
          IMPERSONATION SESSION ACTIVE — YOU ARE CURRENTLY IMPERSONATING{" "}
          <span className="underline uppercase">{user?.name || "USER"}</span> (
          {user?.email || "N/A"})
        </span>
      </div>
      <button
        onClick={handleExitImpersonation}
        className="px-3 py-1 bg-slate-950 text-amber-400 hover:bg-slate-900 border border-amber-500 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        STOP IMPERSONATING
      </button>
    </div>
  );
}
