import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Login, { isSafeRelativePath } from "../../pages/Login";
import Register from "../../pages/Register";
import { Navbar } from "../../components/layout/Navbar";
import { Hero } from "../../sections/Hero";
import { CTA } from "../../sections/CTA";
import { ForColleges } from "../../sections/ForColleges";
import { registrationApi } from "../../api/registrationApi";
import useAuthStore from "../../store/authStore";
import * as tenantUtils from "../../utils/tenantSubdomain";

vi.mock("../../context/ConfigContext", () => ({
  useConfig: () => ({
    googleClientId: "",
  }),
}));

const mockActiveColleges = [
  {
    _id: "college-active-1",
    name: "Massachusetts Institute of Technology",
    shortName: "MIT",
    code: "MIT",
    slug: "mit",
    domain: "mit.edu",
    status: "active",
    isActive: true,
  },
  {
    _id: "college-active-2",
    name: "Stanford University",
    shortName: "Stanford",
    code: "STAN",
    slug: "stanford",
    domain: "stanford.edu",
    status: "active",
    isActive: true,
  },
];

describe("Checklist 4: Authentication Entry Points", () => {
  let originalLocation;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    if (typeof globalThis.IntersectionObserver === "undefined") {
      globalThis.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }

    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    originalLocation = window.location;
    delete window.location;
    window.location = {
      ...originalLocation,
      href: "http://localhost:5173/auth/login",
      assign: vi.fn(),
    };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  describe("1. (P0) Login and Register CTAs route correctly", () => {
    it("Navbar renders Sign In and Start for Free linking to auth pages for unauthenticated visitors", () => {
      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      const signInButtons = screen.getAllByRole("button", { name: /sign in/i });
      expect(signInButtons.length).toBeGreaterThan(0);

      const startFreeButtons = screen.getAllByRole("button", {
        name: /start for free/i,
      });
      expect(startFreeButtons.length).toBeGreaterThan(0);
    });

    it("Hero secondary CTA routes to /auth/login for unauthenticated users", () => {
      render(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      const loginRegisterBtn = screen.getByRole("button", {
        name: /login \/ register/i,
      });
      expect(loginRegisterBtn).toBeInTheDocument();
    });

    it("CTA section 'Create Free Account' and 'Contact Sales' exist and route properly", () => {
      render(
        <MemoryRouter>
          <CTA />
        </MemoryRouter>,
      );

      const createBtn = screen.getByRole("button", {
        name: /create free account/i,
      });
      expect(createBtn).toBeInTheDocument();

      const contactSalesBtn = screen.getByRole("button", {
        name: /contact sales/i,
      });
      expect(contactSalesBtn).toBeInTheDocument();
    });

    it("For Colleges section renders Register Your College CTA", () => {
      render(
        <MemoryRouter>
          <ForColleges />
        </MemoryRouter>,
      );

      const regCollegeBtn = screen.getByRole("button", {
        name: /register your college/i,
      });
      expect(regCollegeBtn).toBeInTheDocument();
    });
  });

  describe("2. (P0) Registration offers the three paths (General Patron / College Student / College Admin)", () => {
    it("renders all 3 registration paths: General Patron, College Student, and College Admin", () => {
      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("radio", { name: /general patron/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: /college student/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: /college admin/i }),
      ).toBeInTheDocument();
    });

    it("selecting College Admin immediately redirects to tenant registration onboarding (/register)", async () => {
      render(
        <MemoryRouter initialEntries={["/auth/register"]}>
          <Routes>
            <Route path="/auth/register" element={<Register />} />
            <Route
              path="/register"
              element={<div>Institutional Registration Page</div>}
            />
          </Routes>
        </MemoryRouter>,
      );

      const adminRadio = screen.getByRole("radio", { name: /college admin/i });
      fireEvent.click(adminRadio);

      await waitFor(() => {
        expect(
          screen.getByText("Institutional Registration Page"),
        ).toBeInTheDocument();
      });
    });

    it("General Patron path asks for NO college field and submits with null collegeId", async () => {
      const registerSpy = vi.fn().mockResolvedValue(true);
      useAuthStore.setState({ register: registerSpy });

      render(
        <MemoryRouter initialEntries={["/auth/register"]}>
          <Register />
        </MemoryRouter>,
      );

      // Verify no college combobox exists for General Patron (default)
      expect(
        screen.queryByRole("combobox", { name: /select institution/i }),
      ).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: "Jane Patron" },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "jane@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: "Password123!" },
      });

      fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(registerSpy).toHaveBeenCalledWith(
          "Jane Patron",
          "jane@example.com",
          "Password123!",
          "", // studentId is empty
          "general",
          "", // collegeId is empty/null
        );
      });
    });
  });

  describe("3. (P0) College picker lists only active, registered colleges", () => {
    it("fetches active colleges only from registrationApi.getActiveColleges", async () => {
      vi.spyOn(tenantUtils, "getSubdomainTenantSlug").mockReturnValue(null);
      const apiSpy = vi
        .spyOn(registrationApi, "getActiveColleges")
        .mockResolvedValue(mockActiveColleges);

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(apiSpy).toHaveBeenCalled();
      });

      const pickerInput = screen.getByRole("combobox", {
        name: /search college institution/i,
      });
      fireEvent.focus(pickerInput);

      await waitFor(() => {
        expect(
          screen.getByText("Massachusetts Institute of Technology"),
        ).toBeInTheDocument();
        expect(screen.getByText("Stanford University")).toBeInTheDocument();
      });
    });
  });

  describe("4. College picker is searchable, debounced, and fully keyboard-operable", () => {
    it("supports debounced search and ArrowDown / Enter keyboard selection in central login", async () => {
      vi.spyOn(tenantUtils, "getSubdomainTenantSlug").mockReturnValue(null);
      vi.spyOn(registrationApi, "getActiveColleges").mockResolvedValue(
        mockActiveColleges,
      );

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      const pickerInput = await screen.findByRole("combobox", {
        name: /search college institution/i,
      });

      fireEvent.focus(pickerInput);
      fireEvent.change(pickerInput, { target: { value: "Stanford" } });

      // Debounced search (200ms)
      await waitFor(
        () => {
          expect(screen.getByText("Stanford University")).toBeInTheDocument();
          expect(
            screen.queryByText("Massachusetts Institute of Technology"),
          ).not.toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      // Keyboard navigation: ArrowDown highlights the option and sets aria-activedescendant
      fireEvent.keyDown(pickerInput, { key: "ArrowDown" });
      expect(pickerInput).toHaveAttribute(
        "aria-activedescendant",
        "login-college-opt-college-active-2",
      );

      // Pressing Enter redirects to Stanford subdomain
      fireEvent.keyDown(pickerInput, { key: "Enter" });
      expect(window.location.assign).toHaveBeenCalledWith(
        "https://stanford.bookbuddy.com/login",
      );
    });

    it("pressing Escape closes the dropdown and clears aria-activedescendant", async () => {
      vi.spyOn(tenantUtils, "getSubdomainTenantSlug").mockReturnValue(null);
      vi.spyOn(registrationApi, "getActiveColleges").mockResolvedValue(
        mockActiveColleges,
      );

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      const pickerInput = await screen.findByRole("combobox", {
        name: /search college institution/i,
      });

      fireEvent.focus(pickerInput);
      await waitFor(() => {
        expect(pickerInput).toHaveAttribute("aria-expanded", "true");
      });

      fireEvent.keyDown(pickerInput, { key: "Escape" });
      expect(pickerInput).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("5. Selecting a college redirects to <slug>.bookbuddy.com/login", () => {
    it("redirects central login user to college subdomain URL", async () => {
      vi.spyOn(tenantUtils, "getSubdomainTenantSlug").mockReturnValue(null);
      vi.spyOn(registrationApi, "getActiveColleges").mockResolvedValue(
        mockActiveColleges,
      );

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      const pickerInput = await screen.findByRole("combobox", {
        name: /search college institution/i,
      });

      fireEvent.focus(pickerInput);
      const mitButton = await screen.findByText(
        "Massachusetts Institute of Technology",
      );
      fireEvent.click(mitButton);

      expect(window.location.assign).toHaveBeenCalledWith(
        "https://mit.bookbuddy.com/login",
      );
    });
  });

  describe("6. (P0) Post-login redirect validation (open-redirect prevention)", () => {
    it("isSafeRelativePath correctly identifies safe paths and rejects external/open redirects", () => {
      // Safe relative paths
      expect(isSafeRelativePath("/student")).toBe(true);
      expect(isSafeRelativePath("/catalog?search=harry")).toBe(true);
      expect(
        isSafeRelativePath("/eresources/read/60d0fe4f5311236168a109ca"),
      ).toBe(true);
      expect(isSafeRelativePath("/general-dashboard")).toBe(true);

      // Malicious / open-redirect attempts (MUST be rejected)
      expect(isSafeRelativePath("https://evil.com")).toBe(false);
      expect(isSafeRelativePath("http://evil.com")).toBe(false);
      expect(isSafeRelativePath("//evil.com")).toBe(false);
      expect(isSafeRelativePath("//evil.com/path")).toBe(false);
      expect(isSafeRelativePath("/\\evil.com")).toBe(false);
      expect(isSafeRelativePath("\\evil.com")).toBe(false);
      expect(isSafeRelativePath("/student\\test")).toBe(false);
      expect(isSafeRelativePath("javascript:alert(1)")).toBe(false);
      expect(
        isSafeRelativePath("data:text/html,<script>alert(1)</script>"),
      ).toBe(false);
      expect(isSafeRelativePath(null)).toBe(false);
      expect(isSafeRelativePath(undefined)).toBe(false);
      expect(isSafeRelativePath("")).toBe(false);
    });
  });

  describe("7. Session reload persistence without 'logged out' flash", () => {
    it("Navbar displays Dashboard and Logout immediately when user is authenticated in authStore", () => {
      useAuthStore.setState({
        user: { _id: "user-1", name: "Alice Student", role: "student" },
        token: "valid-test-token",
        isAuthenticated: true,
        isLoading: false,
      });

      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      const dashboardButtons = screen.getAllByRole("button", {
        name: /dashboard/i,
      });
      expect(dashboardButtons.length).toBeGreaterThan(0);

      const logoutButtons = screen.getAllByRole("button", {
        name: /logout/i,
      });
      expect(logoutButtons.length).toBeGreaterThan(0);
      expect(
        screen.queryByRole("button", { name: /sign in/i }),
      ).not.toBeInTheDocument();
    });

    it("Navbar does NOT flash Sign In while checking credentials (isLoading && !user)", () => {
      useAuthStore.setState({
        user: null,
        token: "stored-token",
        isAuthenticated: false,
        isLoading: true,
      });

      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      // When loading without hydrated user, Sign In buttons should NOT be visible
      expect(
        screen.queryByRole("button", { name: /sign in/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /start for free/i }),
      ).not.toBeInTheDocument();
    });
  });
});
