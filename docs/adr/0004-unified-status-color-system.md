# ADR 0004: Unified Status Color & Indicator System

## Context
Across BookBuddy's dashboards and public landing pages, status communication was fragmented. Different modules used conflicting colors and visual conventions for the same semantic meaning:
- `fulfilled` book requests appeared in blue, while `delivered` appeared in emerald.
- Status dots were conflated with unread UI markers (e.g. notifications) and decorative metric card iconography.
- Some badges relied solely on color without text labels or iconography, violating WCAG 2.1 SC 1.4.1 (Use of Color).
- Silent fallbacks masked typos or unmapped backend enum states in development.

## Decision
We establish a canonical, single-source-of-truth status token and badge architecture:

1. **Semantic Categories**:
   Every status enum maps to exactly one of seven semantic categories:
   - `success` (Emerald): Fully completed, active, available, published, healthy states.
   - `pending` (Amber): Awaiting external review, approval, moderation, or pickup (passive bottleneck).
   - `progress` (Sky Blue): Active running pipeline, in transit, fulfilling, processing.
   - `warning` (Amber): Attention required, degraded health, temporary suspension, upcoming due date.
   - `danger` (Rose): Critical failures, rejections, unpaid/overdue fines, breached thresholds.
   - `neutral` (Slate): Inactive, closed, archived, draft, waived.
   - `unknown` (Slate): Missing or unmapped status (raises an error in dev/test, logs warning with fallback in prod).

2. **Decoupling UI State from Status**:
   - Status dots are strictly for entity lifecycles.
   - Unread items (e.g. notifications, messages) use BookBuddy's brand indigo accent (`bg-indigo-600`), marked with explicit `sr-only` text ("Unread").
   - Metric cards on admin overviews use domain icons (`Building`, `Users`, `Database`, `Clock`), not status dots.

3. **Universal Component (`StatusBadge` & `StatusDot`)**:
   - `StatusBadge` provides consistent padding, border radius, accessible color pairings, WCAG 1.4.11 contrast ratios ($\ge 4.5:1$ text, $\ge 3:1$ indicator), and an accompanying Lucide icon.
   - Includes full screen-reader accessibility (`role="status"`, hidden decorative icons, accessible fallback labels).

4. **Fail-Fast Development Rule**:
   - In `development` and `test` environments (`NODE_ENV !== 'production'`), passing an unregistered status string to `getStatusMeta()` throws an explicit error immediately.
   - In `production`, it falls back safely to `unknown` (neutral Slate) and outputs a `console.warn` to prevent UI crashes while alerting telemetry.

## Consequences
- Single point of change: adding or modifying a status enum requires updating `frontend/src/tokens/statusRegistry.js`.
- Elimination of color ambiguity across student, college admin, and super admin interfaces.
- Ensured WCAG 2.1 AA accessibility compliance across all status indicators.
