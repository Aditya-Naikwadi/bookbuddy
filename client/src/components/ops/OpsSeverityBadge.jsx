/**
 * OpsSeverityBadge
 * Clean enterprise status badge system for BookBuddy Super Admin Console.
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
          bg: "bg-emerald-50",
          border: "border-emerald-200/80",
          text: "text-emerald-700 font-semibold",
          dot: "bg-emerald-500",
          code: "Active",
        };
      case "warning":
      case "warn":
      case "suspended":
        return {
          bg: "bg-amber-50",
          border: "border-amber-200/80",
          text: "text-amber-800 font-semibold",
          dot: "bg-amber-500",
          code: "Warning",
        };
      case "critical":
      case "crit":
      case "error":
      case "failed":
      case "rejected":
        return {
          bg: "bg-rose-50",
          border: "border-rose-200/80",
          text: "text-rose-700 font-semibold",
          dot: "bg-rose-500",
          code: "Critical",
        };
      case "pending":
      case "review":
        return {
          bg: "bg-blue-50",
          border: "border-blue-200/80",
          text: "text-blue-700 font-semibold",
          dot: "bg-blue-500",
          code: "Pending",
        };
      case "info":
      default:
        return {
          bg: "bg-slate-100",
          border: "border-slate-200",
          text: "text-slate-700 font-medium",
          dot: "bg-slate-400",
          code: "Info",
        };
    }
  };

  const style = getStyle();
  const displayText = label || style.code;

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px]"
      : size === "lg"
        ? "px-3.5 py-1 text-xs"
        : "px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full font-sans tracking-tight ${style.bg} ${style.border} ${style.text} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      )}
      <span>{displayText}</span>
    </span>
  );
}

export default OpsSeverityBadge;
