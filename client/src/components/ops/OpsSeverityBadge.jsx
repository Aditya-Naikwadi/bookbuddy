import React from "react";

/**
 * OpsSeverityBadge
 * Signature status/severity indicator system for BookBuddy Super Admin Portal.
 * Supports: 'healthy' | 'info' | 'warning' | 'critical' | 'pending' | 'active' | 'suspended'
 */
export function OpsSeverityBadge({
  status = "info",
  label = "",
  size = "md",
  showDot = true,
  className = "",
}) {
  const normalized = String(status).toLowerCase();

  const getStyle = () => {
    switch (normalized) {
      case "healthy":
      case "ok":
      case "active":
      case "approved":
      case "success":
        return {
          bg: "bg-emerald-950/60",
          border: "border-emerald-700/60",
          text: "text-emerald-300",
          dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
          code: "OK",
        };
      case "warning":
      case "warn":
      case "suspended":
        return {
          bg: "bg-amber-950/60",
          border: "border-amber-700/60",
          text: "text-amber-300",
          dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
          code: "WARN",
        };
      case "critical":
      case "crit":
      case "error":
      case "failed":
      case "rejected":
        return {
          bg: "bg-rose-950/60",
          border: "border-rose-700/60",
          text: "text-rose-300",
          dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse",
          code: "CRIT",
        };
      case "pending":
      case "review":
        return {
          bg: "bg-blue-950/60",
          border: "border-blue-700/60",
          text: "text-blue-300",
          dot: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]",
          code: "PENDING",
        };
      case "info":
      default:
        return {
          bg: "bg-slate-900/80",
          border: "border-slate-700/80",
          text: "text-slate-300",
          dot: "bg-slate-400",
          code: "INFO",
        };
    }
  };

  const style = getStyle();
  const displayText = label || style.code;

  const sizeClasses =
    size === "sm"
      ? "px-1.5 py-0.5 text-[10px]"
      : size === "lg"
        ? "px-3 py-1 text-xs"
        : "px-2 py-0.5 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-bold tracking-wider uppercase border rounded ${style.bg} ${style.border} ${style.text} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      )}
      <span>{displayText}</span>
    </span>
  );
}

export default OpsSeverityBadge;
