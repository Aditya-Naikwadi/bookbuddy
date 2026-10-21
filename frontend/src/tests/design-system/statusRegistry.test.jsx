import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { resolveStatus } from "../../tokens/statusRegistry";
import { STATUS_CATEGORIES, UI_STATE_MARKERS } from "../../tokens/statusTokens";
import { StatusBadge, StatusDot } from "../../components/common/StatusBadge";

describe("Design System: Status Registry & Token Architecture", () => {
  // Authoritative list of every enum extracted from BookBuddy backend models & schemas
  const SCHEMA_STATUS_ENUMS = [
    // Content Moderation & E-Resources
    "pending",
    "pending_review",
    "approved",
    "rejected",
    "published",
    "flagged",

    // User & College Lifecycle
    "invited",
    "active",
    "inactive",
    "disabled",
    "suspended",
    "expired",
    "archived",
    "submitted",
    "unverified",

    // Circulation & Loans
    "available",
    "checked_out",
    "on_hold",
    "returned",
    "overdue",

    // Reservations & Queue Holds
    "queued",
    "ready_for_pickup",
    "ready_to_confirm",
    "fulfilled",
    "cancelled",

    // Fines & Payments
    "unpaid",
    "paid",
    "waived",

    // Procurement & Orders
    "draft",
    "ordered",
    "received",
    "acquired",
    "under_review",

    // Complaints & Tickets
    "open",
    "in_progress",
    "resolved",
    "closed",
    "reported",
    "dismissed",

    // Facilities & Lab Bookings
    "held",
    "confirmed",
    "checked-in",
    "completed",
    "no-show",
    "no_show",
    "operational",
    "maintenance",
    "retired",
    "institutional-block",

    // Batch Upload & Delivery
    "processing",
    "committed",
    "failed",
    "sent",
    "bounced",
    "no_contact_info",
    "sms_queued",
    "active_preserved",
    "deactivated",

    // Health signals
    "healthy",
    "ok",
    "success",
    "warning",
    "warn",
    "critical",
    "error",
  ];

  it("13. Exhaustive Mapping: Every schema enum returns a valid category, label, and icon", () => {
    SCHEMA_STATUS_ENUMS.forEach((status) => {
      const resolved = resolveStatus(status);
      expect(
        resolved,
        `Status "${status}" must resolve to a valid metadata object`,
      ).toBeDefined();
      expect(
        resolved.category,
        `Status "${status}" must have a valid category`,
      ).toBeDefined();
      expect(
        STATUS_CATEGORIES[resolved.category],
        `Category "${resolved.category}" must exist in STATUS_CATEGORIES`,
      ).toBeDefined();
      expect(
        resolved.label,
        `Status "${status}" must have a human-readable label`,
      ).toBeTruthy();
      expect(resolved.label).not.toBe(status); // Must be formatted, not the raw snake_case enum
      expect(
        resolved.icon,
        `Status "${status}" must define a Lucide icon`,
      ).toBeTruthy();
    });
  });

  it("Explicitly confirms published, overdue, unpaid, queued, ready_for_pickup, no-show, and invited are mapped", () => {
    const requiredStatuses = [
      { status: "published", expectedCategory: "success" },
      { status: "overdue", expectedCategory: "warning" },
      { status: "unpaid", expectedCategory: "warning" },
      { status: "queued", expectedCategory: "pending" },
      { status: "ready_for_pickup", expectedCategory: "success" },
      { status: "no-show", expectedCategory: "danger" },
      { status: "invited", expectedCategory: "pending" },
    ];

    requiredStatuses.forEach(({ status, expectedCategory }) => {
      const resolved = resolveStatus(status);
      expect(resolved.category).toBe(expectedCategory);
      expect(resolved.label).toBeTruthy();
      expect(resolved.icon).toBeTruthy();
    });
  });

  it("5. Fail-Fast in Dev/Test: Unmapped status throws an error loudly", () => {
    expect(() => {
      resolveStatus("some_completely_bogus_status_value_xyz");
    }).toThrowError(/\[StatusRegistry\] Unmapped status value/);
  });

  it("Gracefully falls back to neutral unknown state in production with warning", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const resolved = resolveStatus("unmapped_production_item");
      expect(resolved.category).toBe("unknown");
      expect(resolved.label).toBe("Unmapped Production Item");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unmapped status"),
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      warnSpy.mockRestore();
    }
  });

  describe("14. Visual & Accessibility Snapshots for All Categories", () => {
    const sampleStatuses = [
      { category: "success", status: "approved" },
      { category: "pending", status: "pending" },
      { category: "progress", status: "in_progress" },
      { category: "warning", status: "overdue" },
      { category: "danger", status: "rejected" },
      { category: "neutral", status: "closed" },
    ];

    sampleStatuses.forEach(({ category, status }) => {
      it(`Renders category "${category}" with accessible dot and human-readable label`, () => {
        const { container } = render(
          <StatusBadge status={status} size="md" showDot />,
        );
        const resolved = resolveStatus(status);
        expect(screen.getByText(resolved.label)).toBeInTheDocument();
        const dot = container.querySelector('span[aria-hidden="true"]');
        expect(dot).toBeInTheDocument();
        expect(dot).toHaveClass("rounded-full");
        expect(dot.className).toContain(resolved.dot.split(" ")[0]);
      });

      it(`Renders category "${category}" with accessible icon`, () => {
        const { container } = render(
          <StatusBadge status={status} size="md" showIcon />,
        );
        const resolved = resolveStatus(status);
        expect(screen.getByText(resolved.label)).toBeInTheDocument();
        const svg = container.querySelector("svg");
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute("aria-hidden", "true");
      });
    });

    it("StatusDot renders visually hidden screen-reader label (WCAG 1.4.1)", () => {
      render(<StatusDot status="active" label="System Active" />);
      const srLabel = screen.getByText("System Active");
      expect(srLabel).toHaveClass("sr-only");
    });

    it("Live updates announce status via aria-live when live prop is true (WCAG 4.1.3)", () => {
      render(<StatusBadge status="approved" live />);
      const badge = screen.getByText("Approved").closest('span[role="status"]');
      expect(badge).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("8. UI-State Unread Marker (Decoupled from status)", () => {
    it("Defines brand indigo unread markers with clear screen-reader label", () => {
      expect(UI_STATE_MARKERS.unread.dot).toContain("bg-indigo-600");
      expect(UI_STATE_MARKERS.unread.label).toBe("Unread");
    });
  });
});
