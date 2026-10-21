# BookBuddy Design System: Status Color & Indicator Guide

This guide establishes the canonical standard for how BookBuddy communicates status across all dashboards, tables, cards, and public landing pages. Every color has **one universal meaning** throughout the system.

---

## 1. Principles & Hard Architectural Constraints

1. **One Color, One Meaning**: Never repurpose a status color for an unrelated state (e.g. do not use blue for "fulfilled" or red for a non-critical notice).
2. **Accessible by Default (WCAG 2.1 AA)**:
   - **SC 1.4.1 (Use of Color)**: Color is never the sole communicator of status. Every indicator must feature an accompanying text label and/or distinct icon shape.
   - **SC 1.4.11 (Non-text Contrast)**: All visual indicators (dots, icons, borders) maintain $\ge 3:1$ contrast against their surrounding backgrounds. All text maintains $\ge 4.5:1$ contrast.
3. **Decouple Status from UI Notifications**:
   - Status indicators represent **domain entity lifecycles** (loans, approvals, tickets, users).
   - UI indicators (unread notifications, new badges) represent **user attention state** and strictly use BookBuddy's brand indigo accent (`bg-indigo-600`), never domain status colors.
4. **Single Source of Truth**:
   - All styling tokens reside in [`statusTokens.js`](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/frontend/src/tokens/statusTokens.js).
   - All schema mappings reside in [`statusRegistry.js`](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/frontend/src/tokens/statusRegistry.js).
   - All rendering must use `<StatusBadge />` or `<StatusDot />` from [`StatusBadge.jsx`](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/frontend/src/components/common/StatusBadge.jsx).
5. **Fail-Fast in Development**:
   - Passing an unmapped status string in development or test immediately throws an error to prevent silent UI drift.

---

## 2. The 7 Semantic Categories

| Category | Meaning | Color | Default Icon | Tailwind Classes (Light / Dark) | Example Statuses |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`success`** | Positive terminal state, nominal, available, published | Emerald Green | `CheckCircle2` | `bg-emerald-50 text-emerald-800` / `dark:bg-emerald-950/40 dark:text-emerald-300` | `approved`, `published`, `available`, `fulfilled`, `resolved`, `paid`, `confirmed`, `received` |
| **`pending`** | Queued, waiting external review or pickup bottleneck | Amber | `Clock` | `bg-amber-50 text-amber-800` / `dark:bg-amber-950/40 dark:text-amber-300` | `pending`, `open`, `review`, `queued`, `on_hold`, `submitted`, `invited` |
| **`progress`** | Actively executing pipeline or transit | Sky Blue | `Loader2` / `Truck` | `bg-sky-50 text-sky-800` / `dark:bg-sky-950/40 dark:text-sky-300` | `in_progress`, `processing`, `ordered`, `in_transit`, `sms_queued` |
| **`warning`** | Requires attention, remediation, impending deadline | Orange | `AlertTriangle` | `bg-orange-50 text-orange-900` / `dark:bg-orange-950/40 dark:text-orange-300` | `warning`, `overdue`, `unpaid`, `suspended`, `maintenance`, `checked_out`, `bounced` |
| **`danger`** | Negative terminal state, failure, rejection, critical | Rose / Red | `XCircle` | `bg-rose-50 text-rose-800` / `dark:bg-rose-950/40 dark:text-rose-300` | `critical`, `failed`, `rejected`, `cancelled`, `expired`, `no-show`, `disabled` |
| **`neutral`** | Informational, archived, closed, non-actionable | Slate Grey | `HelpCircle` / `Check` | `bg-slate-100 text-slate-800` / `dark:bg-slate-800/60 dark:text-slate-300` | `draft`, `closed`, `waived`, `inactive`, `retired`, `archived` |
| **`unknown`** | Fallback for missing/unregistered states | Zinc Grey | `AlertCircle` | `bg-zinc-100 text-zinc-700` / `dark:bg-zinc-800/60 dark:text-zinc-400` | Fallback only; logs a warning in production |

---

## 3. UI State Markers vs. Status Dots

### ❌ The Anti-Pattern
Using red or amber dots to show unread messages, or blue dots on static dashboard metric cards:
```jsx
// ❌ BAD: Conflating an unread message indicator with a danger/terminal status
<span className="w-2 h-2 rounded-full bg-rose-500" />

// ❌ BAD: Decorative pseudo-status dot on a telemetry card
<div className="flex items-center gap-2">
  <span className="w-2 h-2 rounded-full bg-blue-500" />
  <h3>Total Colleges</h3>
</div>
```

### ✅ The Standard
1. **Unread Notifications**: Always use BookBuddy brand indigo accent with screen-reader text:
```jsx
// ✅ GOOD: Standard unread notification marker
<span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" aria-hidden="true" />
<span className="sr-only">Unread</span>
```
2. **Telemetry / Metric Cards**: Use descriptive Lucide domain icons instead of dots:
```jsx
// ✅ GOOD: Domain icons for metrics
<div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
  <Building2 className="w-4 h-4 text-indigo-500" aria-hidden="true" />
  <h3>Total Colleges</h3>
</div>
```

---

## 4. Component Usage Guide

### Basic Status Badge
```jsx
import StatusBadge from '@/components/common/StatusBadge';

// Renders an accessible badge with dot and humanized text:
<StatusBadge status="approved" />
// Output: [● Approved] in Emerald styling

// With an icon instead of a dot:
<StatusBadge status="overdue" showIcon />
// Output: [⚠️ Overdue] in Orange styling

// Compact size for dense table cells:
<StatusBadge status="in_progress" size="sm" showIcon />
```

### Inline Status Dot
When space is limited (e.g. mobile list items or compact rows):
```jsx
import { StatusDot } from '@/components/common/StatusBadge';

<div className="flex items-center gap-2">
  <StatusDot status="operational" />
  <span>System Operational</span>
</div>
```

### Real-Time Live Status Updates
For dynamically changing statuses (e.g. WebSocket job feeds or telemetry):
```jsx
<StatusBadge status={job.status} live={true} />
// Automatically sets aria-live="polite" and aria-atomic="true"
```

---

## 5. Adding New Statuses

When a new backend model or status enum is added:
1. Open [`frontend/src/tokens/statusRegistry.js`](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/frontend/src/tokens/statusRegistry.js).
2. Add the normalized status string to `STATUS_REGISTRY` with its semantic `category`, human-readable `label`, and Lucide `icon`:
   ```javascript
   export const STATUS_REGISTRY = {
     // ...
     partially_refunded: {
       category: 'warning',
       label: 'Partially Refunded',
       icon: 'AlertTriangle',
     },
   };
   ```
3. Run `npm test` to verify the exhaustive schema mapping test in `frontend/src/tests/design-system/statusRegistry.test.jsx`.
