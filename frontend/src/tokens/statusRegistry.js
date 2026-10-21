/**
 * statusRegistry.js
 * BookBuddy Design System: Authoritative Status Registry.
 *
 * Maps every status enum across all domains to a semantic category,
 * human-readable label, and Lucide icon.
 *
 * In development and testing, an unmapped status throws an error loudly to
 * prevent drift. In production, it gracefully renders an 'unknown' neutral
 * badge and logs a diagnostic warning.
 */

import { STATUS_CATEGORIES } from "./statusTokens";

export const STATUS_REGISTRY = {
  // ==========================================
  // Success (Emerald Green)
  // ==========================================
  active: { category: "success", label: "Active", icon: "CheckCircle2" },
  approved: { category: "success", label: "Approved", icon: "CheckCircle2" },
  published: { category: "success", label: "Published", icon: "CheckCircle2" },
  available: { category: "success", label: "Available", icon: "CheckCircle2" },
  fulfilled: { category: "success", label: "Fulfilled", icon: "CheckCircle2" },
  resolved: { category: "success", label: "Resolved", icon: "CheckCircle2" },
  paid: { category: "success", label: "Paid", icon: "CheckCircle2" },
  confirmed: { category: "success", label: "Confirmed", icon: "CheckCircle2" },
  "checked-in": {
    category: "success",
    label: "Checked In",
    icon: "CheckCircle2",
  },
  completed: { category: "success", label: "Completed", icon: "CheckCircle2" },
  committed: { category: "success", label: "Committed", icon: "CheckCircle2" },
  sent: { category: "success", label: "Sent", icon: "CheckCircle2" },
  operational: {
    category: "success",
    label: "Operational",
    icon: "CheckCircle2",
  },
  acquired: { category: "success", label: "Acquired", icon: "CheckCircle2" },
  received: { category: "success", label: "Received", icon: "CheckCircle2" },
  ready_for_pickup: {
    category: "success",
    label: "Ready for Pickup",
    icon: "CheckCircle2",
  },
  ready_to_confirm: {
    category: "success",
    label: "Ready to Confirm",
    icon: "CheckCircle2",
  },
  returned: { category: "success", label: "Returned", icon: "CheckCircle2" },
  healthy: { category: "success", label: "Healthy", icon: "CheckCircle2" },
  ok: { category: "success", label: "Nominal", icon: "CheckCircle2" },
  success: { category: "success", label: "Success", icon: "CheckCircle2" },

  // ==========================================
  // Pending Review & Queue Blocked (Amber)
  // ==========================================
  pending: { category: "pending", label: "Pending Review", icon: "Clock" },
  open: { category: "pending", label: "Open", icon: "Clock" },
  pending_review: {
    category: "pending",
    label: "Pending Review",
    icon: "Clock",
  },
  review: { category: "pending", label: "Under Review", icon: "Clock" },
  submitted: { category: "pending", label: "Submitted", icon: "Clock" },
  under_review: { category: "pending", label: "Under Review", icon: "Clock" },
  queued: { category: "pending", label: "Queued", icon: "Clock" },
  held: { category: "pending", label: "On Hold", icon: "Clock" },
  on_hold: { category: "pending", label: "On Hold", icon: "Clock" },
  requested: { category: "pending", label: "Requested", icon: "Clock" },
  reported: { category: "pending", label: "Reported", icon: "Clock" },
  unverified: { category: "pending", label: "Unverified", icon: "Clock" },
  invited: { category: "pending", label: "Invited", icon: "Clock" },

  // ==========================================
  // Active Execution Pipeline (Sky Blue)
  // ==========================================
  in_progress: { category: "progress", label: "In Progress", icon: "Loader2" },
  processing: { category: "progress", label: "Processing", icon: "Loader2" },
  ordered: { category: "progress", label: "Ordered", icon: "Truck" },
  in_transit: { category: "progress", label: "In Transit", icon: "Truck" },
  sms_queued: {
    category: "progress",
    label: "SMS Dispatched",
    icon: "Loader2",
  },
  soft_locked: {
    category: "progress",
    label: "Reserved (Soft Lock)",
    icon: "Clock",
  },

  // ==========================================
  // Warning & Needs Remediation (Orange)
  // ==========================================
  warning: { category: "warning", label: "Warning", icon: "AlertTriangle" },
  warn: {
    category: "warning",
    label: "Attention Needed",
    icon: "AlertTriangle",
  },
  overdue: { category: "warning", label: "Overdue", icon: "AlertTriangle" },
  unpaid: { category: "warning", label: "Unpaid", icon: "AlertTriangle" },
  suspended: { category: "warning", label: "Suspended", icon: "AlertTriangle" },
  maintenance: {
    category: "warning",
    label: "Maintenance",
    icon: "AlertTriangle",
  },
  no_contact_info: {
    category: "warning",
    label: "Missing Contact Info",
    icon: "AlertTriangle",
  },
  bounced: {
    category: "warning",
    label: "Delivery Bounced",
    icon: "AlertTriangle",
  },
  flagged: {
    category: "warning",
    label: "Flagged for Audit",
    icon: "AlertTriangle",
  },
  checked_out: { category: "warning", label: "Checked Out", icon: "BookOpen" },

  // ==========================================
  // Danger & Terminal Negative (Rose / Red)
  // ==========================================
  critical: { category: "danger", label: "Critical", icon: "XCircle" },
  crit: { category: "danger", label: "Critical", icon: "XCircle" },
  error: { category: "danger", label: "Error", icon: "XCircle" },
  failed: { category: "danger", label: "Failed", icon: "XCircle" },
  rejected: { category: "danger", label: "Rejected", icon: "XCircle" },
  cancelled: { category: "danger", label: "Cancelled", icon: "XCircle" },
  expired: { category: "danger", label: "Expired", icon: "XCircle" },
  "no-show": { category: "danger", label: "No-Show", icon: "XCircle" },
  no_show: { category: "danger", label: "No-Show", icon: "XCircle" },
  disabled: { category: "danger", label: "Disabled", icon: "XCircle" },
  dismissed: { category: "danger", label: "Dismissed", icon: "XCircle" },
  deactivated: { category: "danger", label: "Deactivated", icon: "XCircle" },
  "institutional-block": {
    category: "danger",
    label: "Blocked by Institution",
    icon: "XCircle",
  },

  // ==========================================
  // Neutral & Informational (Slate)
  // ==========================================
  info: { category: "neutral", label: "Info", icon: "HelpCircle" },
  draft: { category: "neutral", label: "Draft", icon: "FileText" },
  preview: { category: "neutral", label: "Preview", icon: "Eye" },
  closed: { category: "neutral", label: "Closed", icon: "Check" },
  waived: { category: "neutral", label: "Waived", icon: "Check" },
  inactive: { category: "neutral", label: "Inactive", icon: "Minus" },
  retired: { category: "neutral", label: "Retired", icon: "Minus" },
  archived: { category: "neutral", label: "Archived", icon: "Archive" },
  active_preserved: {
    category: "neutral",
    label: "Account Preserved",
    icon: "Check",
  },
};

function formatRawStatus(str) {
  if (!str) return "Unknown";
  return String(str)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolves a raw status string into full semantic tokens and metadata.
 * Throws in development/testing if unmapped; returns 'unknown' neutral fallback in production.
 */
export function resolveStatus(rawStatus) {
  const isDevOrTest =
    typeof globalThis !== "undefined" &&
    globalThis.process?.env?.NODE_ENV === "production"
      ? false
      : (typeof globalThis !== "undefined" &&
          globalThis.process?.env &&
          (globalThis.process.env.NODE_ENV === "development" ||
            globalThis.process.env.NODE_ENV === "test")) ||
        (typeof import.meta !== "undefined" &&
          import.meta.env &&
          (import.meta.env.DEV || import.meta.env.MODE === "test"));

  if (!rawStatus) {
    if (isDevOrTest) {
      throw new Error(
        "[StatusRegistry] Invalid status: status argument is undefined or empty.",
      );
    }
    console.warn(
      "[StatusRegistry] Warning: empty status passed to resolveStatus.",
    );
    return {
      ...STATUS_CATEGORIES.unknown,
      category: "unknown",
      status: "unknown",
      label: "Unknown",
      icon: "AlertCircle",
    };
  }

  const normalized = String(rawStatus).trim().toLowerCase();
  const entry = STATUS_REGISTRY[normalized];

  if (!entry) {
    if (isDevOrTest) {
      throw new Error(
        `[StatusRegistry] Unmapped status value: "${rawStatus}". Every status must be mapped in statusRegistry.js.`,
      );
    }
    console.warn(
      `[StatusRegistry] Warning: Unmapped status "${rawStatus}" encountered. Rendering neutral fallback.`,
    );
    return {
      ...STATUS_CATEGORIES.unknown,
      category: "unknown",
      status: normalized,
      label: formatRawStatus(normalized),
      icon: "AlertCircle",
    };
  }

  const categoryTokens =
    STATUS_CATEGORIES[entry.category] || STATUS_CATEGORIES.unknown;

  return {
    ...categoryTokens,
    category: entry.category,
    status: normalized,
    label: entry.label,
    icon: entry.icon || categoryTokens.defaultIcon,
  };
}
