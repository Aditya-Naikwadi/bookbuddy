/**
 * OpsSeverityBadge.jsx
 * BookBuddy Super Admin Console Adapter.
 *
 * Re-exports the unified StatusBadge from the design system
 * ensuring 100% backward compatibility for all admin portal modules.
 */

import { StatusBadge } from "../common/StatusBadge";

export function OpsSeverityBadge({
  status = "info",
  label = "",
  size = "md",
  showDot = true,
  showIcon = false,
  className = "",
}) {
  return (
    <StatusBadge
      status={status}
      label={label}
      size={size}
      showDot={showDot}
      showIcon={showIcon}
      className={className}
    />
  );
}

export default OpsSeverityBadge;
