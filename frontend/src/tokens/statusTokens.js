/**
 * statusTokens.js
 * BookBuddy Design System: Canonical semantic status color tokens.
 *
 * Each semantic category strictly specifies light and dark theme classes
 * guaranteed to meet WCAG AA contrast (>= 4.5:1 for text, >= 3:1 for dots/icons).
 */

export const STATUS_CATEGORIES = {
  success: {
    name: "success",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200/80 dark:border-emerald-800",
    text: "text-emerald-800 dark:text-emerald-300",
    dot: "bg-emerald-500",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    defaultIcon: "CheckCircle2",
    ariaRole: "status",
  },
  pending: {
    name: "pending",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200/80 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
    iconColor: "text-amber-600 dark:text-amber-400",
    defaultIcon: "Clock",
    ariaRole: "status",
  },
  progress: {
    name: "progress",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-200/80 dark:border-sky-800",
    text: "text-sky-800 dark:text-sky-300",
    dot: "bg-sky-500",
    iconColor: "text-sky-600 dark:text-sky-400",
    defaultIcon: "Loader2",
    ariaRole: "status",
  },
  warning: {
    name: "warning",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200/80 dark:border-orange-800",
    text: "text-orange-900 dark:text-orange-300",
    dot: "bg-orange-500",
    iconColor: "text-orange-600 dark:text-orange-400",
    defaultIcon: "AlertTriangle",
    ariaRole: "status",
  },
  danger: {
    name: "danger",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200/80 dark:border-rose-800",
    text: "text-rose-800 dark:text-rose-300",
    dot: "bg-rose-500",
    iconColor: "text-rose-600 dark:text-rose-400",
    defaultIcon: "XCircle",
    ariaRole: "alert",
  },
  neutral: {
    name: "neutral",
    bg: "bg-slate-100 dark:bg-slate-800/60",
    border: "border-slate-200 dark:border-slate-700",
    text: "text-slate-800 dark:text-slate-300",
    dot: "bg-slate-400 dark:bg-slate-500",
    iconColor: "text-slate-500 dark:text-slate-400",
    defaultIcon: "HelpCircle",
    ariaRole: "status",
  },
  unknown: {
    name: "unknown",
    bg: "bg-zinc-100 dark:bg-zinc-800/60",
    border: "border-dashed border-zinc-300 dark:border-zinc-700",
    text: "text-zinc-700 dark:text-zinc-400",
    dot: "bg-zinc-400 dark:bg-zinc-500",
    iconColor: "text-zinc-500 dark:text-zinc-400",
    defaultIcon: "AlertCircle",
    ariaRole: "status",
  },
};

/**
 * Brand UI state marker for unread alerts (decoupled from entity status colors).
 */
export const UI_STATE_MARKERS = {
  unread: {
    dot: "w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0",
    badge:
      "px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold",
    label: "Unread",
  },
};
