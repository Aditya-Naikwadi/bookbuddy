/**
 * StatusBadge.jsx
 * BookBuddy Design System: Unified Status Badge and Dot Component.
 *
 * Guarantees consistent status communication across the entire application:
 * - Color is never the sole carrier of meaning (WCAG 1.4.1)
 * - Minimum contrast >= 4.5:1 text, >= 3:1 dot/icon (WCAG 1.4.11)
 * - Strict enum registry mapping with development/test assertions
 * - Human-readable translatable labels
 */

import {
  CheckCircle2,
  Clock,
  Loader2,
  Truck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  AlertCircle,
  Eye,
  Archive,
  Minus,
  Check,
  FileText,
  BookOpen,
} from "lucide-react";
import { resolveStatus } from "../../tokens/statusRegistry";

const ICON_MAP = {
  CheckCircle2,
  Clock,
  Loader2,
  Truck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  AlertCircle,
  Eye,
  Archive,
  Minus,
  Check,
  FileText,
  BookOpen,
};

/**
 * StatusDot: Accessible standalone dot indicator with screen-reader text.
 */
export function StatusDot({
  status = "neutral",
  label = "",
  size = "md",
  className = "",
  pulse = false,
}) {
  const resolved = resolveStatus(status);
  const displayLabel = label || resolved.label;

  const dotSizeClass =
    size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-2.5 h-2.5" : "w-2 h-2";

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={displayLabel}
    >
      <span
        className={`${dotSizeClass} rounded-full shrink-0 ${resolved.dot} ${
          pulse ? "animate-pulse" : ""
        }`}
        aria-hidden="true"
      />
      <span className="sr-only">{displayLabel}</span>
    </span>
  );
}

/**
 * StatusBadge: The universal status badge for BookBuddy.
 */
export function StatusBadge({
  status = "neutral",
  label = "",
  size = "md",
  showDot = true,
  showIcon = false,
  live = false,
  className = "",
}) {
  const resolved = resolveStatus(status);
  const displayText = label || resolved.label;

  const IconComponent = ICON_MAP[resolved.icon] || HelpCircle;

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1.5"
      : size === "lg"
        ? "px-3.5 py-1 text-xs gap-2"
        : "px-2.5 py-0.5 text-xs gap-1.5";

  const dotSizeClass =
    size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-2.5 h-2.5" : "w-2 h-2";

  const iconSize = size === "sm" ? 12 : size === "lg" ? 15 : 13;

  return (
    <span
      role={live ? resolved.ariaRole : undefined}
      aria-live={live ? "polite" : undefined}
      className={`inline-flex items-center border rounded-full font-sans tracking-tight ${resolved.bg} ${resolved.border} ${resolved.text} ${sizeClasses} ${className}`}
    >
      {showIcon && (
        <IconComponent
          size={iconSize}
          className={`shrink-0 ${resolved.iconColor}`}
          aria-hidden="true"
        />
      )}
      {showDot && !showIcon && (
        <span
          className={`${dotSizeClass} rounded-full shrink-0 ${resolved.dot}`}
          aria-hidden="true"
        />
      )}
      <span className="font-semibold select-none">{displayText}</span>
    </span>
  );
}

export default StatusBadge;
