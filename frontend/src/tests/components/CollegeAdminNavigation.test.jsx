import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { COLLEGE_ADMIN_NAV_ITEMS } from "../../config/navigation";
import {
  ROLE_ROUTE_MAP,
  isUserAllowedForRoute,
} from "../../config/roleRouteConfig";
import DashboardLayout from "../../layouts/DashboardLayout";
import useAuthStore from "../../store/authStore";
import { FeatureFlagContext } from "../../context/featureFlagContextObject";

vi.mock("../../components/student/NotificationCenter", () => ({
  default: () => <div data-testid="notification-center">Notifications</div>,
}));

vi.mock("../../components/common/ThemeToggle", () => ({
  default: () => <div data-testid="theme-toggle">Theme</div>,
}));

vi.mock("../../components/student/auth/ForcedPasswordChangeModal", () => ({
  ForcedPasswordChangeModal: () => null,
}));

describe("College Admin Navigation & Feature Pages Suite", () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    useAuthStore.setState({
      user: {
        _id: "admin-1",
        name: "Test College Admin",
        email: "admin@college.edu",
        role: "college-admin",
        collegeId: "6aa3e3a8ccadba26a16809ad",
      },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it("1. verifies all 12 desk modules + extras are defined in COLLEGE_ADMIN_NAV_ITEMS", () => {
    const keys = COLLEGE_ADMIN_NAV_ITEMS.map((item) => item.key);
    const expectedModules = [
      "dashboard",
      "patrons",
      "circulation",
      "cataloging",
      "inventory",
      "acquisitions",
      "digital-assets",
      "facilities",
      "finances",
      "helpdesk",
      "features",
      "analytics",
      "bulk-upload",
      "share-requests",
    ];

    expectedModules.forEach((mod) => {
      expect(keys).toContain(mod);
    });

    // Check each desk module routes start with /college-admin
    COLLEGE_ADMIN_NAV_ITEMS.forEach((item) => {
      expect(item.route.startsWith("/college-admin")).toBe(true);
      expect(item.label).toBeDefined();
      expect(item.icon).toBeDefined();
    });
  });

  it("2. verifies ROLE_ROUTE_MAP authorizes both college-admin and college_admin roles for every desk route", () => {
    const collegeAdminRoutes = [
      "/college-admin",
      "/college-admin/patrons",
      "/college-admin/circulation",
      "/college-admin/cataloging",
      "/college-admin/inventory",
      "/college-admin/acquisitions",
      "/college-admin/digital-assets",
      "/college-admin/facilities",
      "/college-admin/finances",
      "/college-admin/helpdesk",
      "/college-admin/features",
      "/college-admin/analytics",
      "/college-admin/bulk-upload",
      "/college-admin/share-requests",
    ];

    const rolesToTest = [
      { role: "college-admin" },
      { role: "college_admin" },
      { role: "admin" },
      { role: "librarian" },
      { role: "super-admin" },
      { role: "super_admin" },
    ];

    collegeAdminRoutes.forEach((route) => {
      expect(ROLE_ROUTE_MAP[route]).toBeDefined();
      rolesToTest.forEach((u) => {
        const allowed = isUserAllowedForRoute(u, route);
        expect(allowed).toBe(true);
      });
    });
  });

  it("3. renders persistent left-side sidebar with Desk Modules section in DashboardLayout", () => {
    const mockFeatureContext = {
      enabledFeatures: [
        "catalog",
        "loans",
        "fines",
        "patron-card",
        "e-resources",
        "facilities",
        "support",
        "analytics",
        "acquisitions",
      ],
      limits: {},
      isLoading: false,
      isError: false,
      isFeatureEnabled: () => true,
      refetchFeatures: vi.fn(),
    };

    render(
      <QueryClientProvider client={queryClient}>
        <FeatureFlagContext.Provider value={mockFeatureContext}>
          <MemoryRouter initialEntries={["/college-admin"]}>
            <DashboardLayout />
          </MemoryRouter>
        </FeatureFlagContext.Provider>
      </QueryClientProvider>,
    );

    // Verify Desk Modules header is present
    const headings = screen.getAllByText("Desk Modules");
    expect(headings.length).toBeGreaterThanOrEqual(1);

    // Verify key desk links render in the sidebar
    expect(screen.getAllByText("Patrons Desk")[0]).toBeDefined();
    expect(screen.getAllByText("Circulation Desk")[0]).toBeDefined();
    expect(screen.getAllByText("Cataloging Desk")[0]).toBeDefined();
    expect(screen.getAllByText("Inventory Overview")[0]).toBeDefined();
    expect(screen.getAllByText("Acquisitions Desk")[0]).toBeDefined();
    expect(screen.getAllByText("Digital Assets Desk")[0]).toBeDefined();
    expect(screen.getAllByText("Facilities Desk")[0]).toBeDefined();
    expect(screen.getAllByText("Finances Desk")[0]).toBeDefined();
    expect(screen.getAllByText("Helpdesk Desk")[0]).toBeDefined();
    expect(screen.getAllByText("Feature Manager")[0]).toBeDefined();
    expect(screen.getAllByText("Campus Analytics")[0]).toBeDefined();
    expect(screen.getAllByText("Bulk Patron Ingestion")[0]).toBeDefined();
  });

  it("4. verifies active-state highlighting on active desk module route", () => {
    const mockFeatureContext = {
      enabledFeatures: ["catalog", "loans"],
      limits: {},
      isLoading: false,
      isError: false,
      isFeatureEnabled: () => true,
      refetchFeatures: vi.fn(),
    };

    render(
      <QueryClientProvider client={queryClient}>
        <FeatureFlagContext.Provider value={mockFeatureContext}>
          <MemoryRouter initialEntries={["/college-admin/circulation"]}>
            <DashboardLayout />
          </MemoryRouter>
        </FeatureFlagContext.Provider>
      </QueryClientProvider>,
    );

    // Find the Circulation Desk navigation link
    const circulationLinks = screen.getAllByRole("link", {
      name: /Circulation Desk/i,
    });
    const desktopLink = circulationLinks[0];

    // Active link has font-bold and border styling
    expect(desktopLink.className).toContain("font-bold");
    expect(desktopLink.className).toContain("bg-indigo-50");
  });

  it("5. respects tenant feature gating: hides non-core modules if tenant feature is disabled", () => {
    // Only core features enabled, facilities and fines disabled
    const mockFeatureContext = {
      enabledFeatures: ["catalog", "patrons"],
      limits: {},
      isLoading: false,
      isError: false,
      isFeatureEnabled: (key) => ["catalog", "patrons"].includes(key),
      refetchFeatures: vi.fn(),
    };

    render(
      <QueryClientProvider client={queryClient}>
        <FeatureFlagContext.Provider value={mockFeatureContext}>
          <MemoryRouter initialEntries={["/college-admin"]}>
            <DashboardLayout />
          </MemoryRouter>
        </FeatureFlagContext.Provider>
      </QueryClientProvider>,
    );

    // Core modules must still be visible
    expect(screen.getAllByText("Patrons Desk")[0]).toBeDefined();
    expect(screen.getAllByText("Cataloging Desk")[0]).toBeDefined();
    expect(screen.getAllByText("Inventory Overview")[0]).toBeDefined();
    expect(screen.getAllByText("Feature Manager")[0]).toBeDefined();

    // Disabled tenant modules must NOT be rendered in sidebar
    expect(screen.queryByText("Facilities Desk")).toBeNull();
    expect(screen.queryByText("Finances Desk")).toBeNull();
  });
});
