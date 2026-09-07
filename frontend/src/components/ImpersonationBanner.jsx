import { useState, useEffect, useCallback } from "react";
import { AlertOctagon, LogOut, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

const getRemainingSecondsFromToken = () => {
  const token = localStorage.getItem("token");
  if (!token || typeof token !== "string") return 300;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return 300;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (!payload.exp) return 300;
    const remaining = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
    return remaining;
  } catch {
    return 300;
  }
};

export default function ImpersonationBanner() {
  const { user, isImpersonated, stopImpersonating } = useAuthStore();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(getRemainingSecondsFromToken);

  const originalToken = localStorage.getItem("originalSuperAdminToken");

  const handleExitImpersonation = useCallback(async () => {
    await stopImpersonating();
    navigate("/admin-portal/users", { replace: true });
  }, [stopImpersonating, navigate]);

  useEffect(() => {
    if (!isImpersonated && !originalToken) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleExitImpersonation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isImpersonated, originalToken, handleExitImpersonation]);

  if (!isImpersonated && !originalToken) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="bg-amber-600 text-slate-950 px-4 py-2 font-mono text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-md z-50 sticky top-0 border-b border-amber-700">
      <div className="flex items-center gap-2">
        <AlertOctagon className="w-4 h-4 text-slate-950 animate-pulse" />
        <span>
          IMPERSONATION SESSION ACTIVE — YOU ARE CURRENTLY IMPERSONATING{" "}
          <span className="underline uppercase">{user?.name || "USER"}</span> (
          {user?.email || "N/A"})
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-slate-950/20 px-2.5 py-1 rounded text-[11px] font-bold border border-slate-950/30">
          <Clock className="w-3.5 h-3.5" />
          <span>SESSION EXPIRES IN: {formattedTime}</span>
        </div>

        <button
          onClick={handleExitImpersonation}
          className="px-3 py-1 bg-slate-950 text-amber-400 hover:bg-slate-900 border border-amber-500 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          STOP IMPERSONATING
        </button>
      </div>
    </div>
  );
}
