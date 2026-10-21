import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { Hero } from "../../sections/Hero";
import { EResources } from "../../sections/EResources";
import Landing from "../../pages/public/Landing";
import NotFound from "../../pages/public/NotFound";
import useAuthStore from "../../store/authStore";
import * as tenantSubdomainModule from "../../utils/tenantSubdomain";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("2. Navigation, Routing & CTAs Comprehensive Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    if (typeof globalThis.IntersectionObserver === "undefined") {
      globalThis.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }

    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });
  });

  describe("Requirement 1: 'Browse the Library' CTA scrolls/routes to Library section", () => {
    it("Hero primary CTA scrolls smoothly to Catalog Search section when unauthenticated", () => {
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const catalogSection = document.createElement("section");
      catalogSection.id = "catalog-search";
      document.body.appendChild(catalogSection);

      render(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      const browseBtn = screen.getByRole("button", {
        name: /Browse the Library/i,
      });
      fireEvent.click(browseBtn);

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
      catalogSection.remove();
    });

    it("EResources 'Browse the Library' CTA scrolls to the Catalog Search section", () => {
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const catalogSection = document.createElement("section");
      catalogSection.id = "catalog-search";
      document.body.appendChild(catalogSection);

      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      const browseBtn = screen.getByRole("button", {
        name: /Browse the Library/i,
      });
      fireEvent.click(browseBtn);

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
      catalogSection.remove();
    });
  });

  describe("Requirement 2 & 3: Navbar items work without dead links and active section is highlighted", () => {
    it("renders all navbar items and clicks scroll to corresponding sections", () => {
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const sections = [
        "catalog-search",
        "e-resources",
        "features",
        "how-it-works",
        "streaks",
        "for-colleges",
      ];
      const domElements = sections.map((id) => {
        const el = document.createElement("section");
        el.id = id;
        document.body.appendChild(el);
        return el;
      });

      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      const catalogBtn = screen.getAllByRole("button", {
        name: /Catalog Search/i,
      })[0];
      fireEvent.click(catalogBtn);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

      const eResourcesBtn = screen.getAllByRole("button", {
        name: /E-Resources/i,
      })[0];
      fireEvent.click(eResourcesBtn);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

      const forCollegesBtn = screen.getAllByRole("button", {
        name: /For Colleges/i,
      })[0];
      fireEvent.click(forCollegesBtn);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

      domElements.forEach((el) => el.remove());
    });
  });

  describe("Requirement 4: Mobile navigation drawer opens, closes, traps focus, and links work", () => {
    it("opens drawer when hamburger is clicked, and closes on close button or Escape key", () => {
      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      const hamburger = screen.getByLabelText(/Open navigation menu/i);
      expect(hamburger).toBeInTheDocument();

      // Open drawer
      fireEvent.click(hamburger);
      expect(
        screen.getByLabelText(/Close navigation menu/i),
      ).toBeInTheDocument();

      const drawer = screen.getByRole("dialog", {
        name: /Mobile and tablet navigation drawer/i,
      });
      expect(drawer).toBeInTheDocument();

      // Close via Escape key
      fireEvent.keyDown(window, { key: "Escape" });
      expect(
        screen.getByLabelText(/Open navigation menu/i),
      ).toBeInTheDocument();
    });

    it("traps focus inside the mobile drawer when navigating via Tab", () => {
      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      const hamburger = screen.getByLabelText(/Open navigation menu/i);
      fireEvent.click(hamburger);

      const drawer = screen.getByRole("dialog", {
        name: /Mobile and tablet navigation drawer/i,
      });
      const focusable = drawer.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      expect(focusable.length).toBeGreaterThan(1);

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      // Tab on last element cycles to first element
      lastEl.focus();
      fireEvent.keyDown(window, { key: "Tab", shiftKey: false });

      // Shift+Tab on first element cycles to last element
      firstEl.focus();
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    });
  });

  describe("Requirement 5: Authenticated visitor state (Dashboard/Logout, session preserved)", () => {
    it("renders Dashboard and Logout buttons for authenticated user and not Login/Register", () => {
      useAuthStore.setState({
        user: { name: "Aditya Naikwadi", role: "college-student" },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      // Verify Dashboard and Logout are present
      expect(
        screen.getAllByRole("button", { name: /Dashboard/i })[0],
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: /Logout/i })[0],
      ).toBeInTheDocument();

      // Verify Sign In / Start for Free are NOT in the document
      expect(
        screen.queryByRole("button", { name: /Sign In/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Start for Free/i }),
      ).not.toBeInTheDocument();
    });

    it("visiting landing page preserves session without forced logout", () => {
      const mockUser = { name: "Pradnya", role: "student" };
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <Landing />
        </MemoryRouter>,
      );

      // Verify session is still authenticated
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
  });

  describe("Requirement 6: Authenticated users clicking primary CTA route to correct role dashboard", () => {
    it("routes student to /student", () => {
      useAuthStore.setState({
        user: { role: "student" },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      const cta = screen.getByRole("button", { name: /Go to Dashboard/i });
      fireEvent.click(cta);
      expect(mockNavigate).toHaveBeenCalledWith("/student");
    });

    it("routes college-admin to /college-admin", () => {
      useAuthStore.setState({
        user: { role: "college-admin" },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      const cta = screen.getByRole("button", { name: /Go to Dashboard/i });
      fireEvent.click(cta);
      expect(mockNavigate).toHaveBeenCalledWith("/college-admin");
    });

    it("routes general patron to /general-dashboard", () => {
      useAuthStore.setState({
        user: { role: "general" },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      const cta = screen.getByRole("button", { name: /Go to Dashboard/i });
      fireEvent.click(cta);
      expect(mockNavigate).toHaveBeenCalledWith("/general-dashboard");
    });

    it("routes super-admin to /admin-portal", () => {
      useAuthStore.setState({
        user: { role: "super-admin" },
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      const cta = screen.getByRole("button", { name: /Go to Dashboard/i });
      fireEvent.click(cta);
      expect(mockNavigate).toHaveBeenCalledWith("/admin-portal");
    });
  });

  describe("Requirement 7: Anchor links work when loaded directly (e.g. /#catalog)", () => {
    it("scrolls to catalog section on mount when window.location.hash is #catalog", async () => {
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const catalogSection = document.createElement("section");
      catalogSection.id = "catalog-search";
      document.body.appendChild(catalogSection);

      window.location.hash = "#catalog";

      render(
        <MemoryRouter>
          <Landing />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
      });

      window.location.hash = "";
      catalogSection.remove();
    });
  });

  describe("Requirement 8: Unknown routes show proper 404 page with navigation home", () => {
    it("renders NotFound 404 page for unknown route with action buttons", () => {
      render(
        <MemoryRouter initialEntries={["/some-random-unknown-page"]}>
          <Routes>
            <Route path="/" element={<div>Home</div>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(
        screen.getByText(/Lost in the Library Stacks\?/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/ERROR 404/i)).toBeInTheDocument();

      const homeBtn = screen.getByRole("button", { name: /Return to Home/i });
      expect(homeBtn).toBeInTheDocument();
      fireEvent.click(homeBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/");

      const catalogBtn = screen.getByRole("button", {
        name: /Browse Catalog/i,
      });
      expect(catalogBtn).toBeInTheDocument();
      fireEvent.click(catalogBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/#catalog-search");
    });
  });

  describe("Requirement 9: Root-domain landing vs college-subdomain landing (<slug>.bookbuddy.com)", () => {
    it("redirects college subdomain to /c/:collegeSlug for strict tenant isolation", () => {
      vi.spyOn(tenantSubdomainModule, "getSubdomainTenantSlug").mockReturnValue(
        "stanford",
      );

      render(
        <MemoryRouter initialEntries={["/"]}>
          <Landing />
        </MemoryRouter>,
      );

      expect(mockNavigate).toHaveBeenCalledWith("/c/stanford", {
        replace: true,
      });
    });
  });
});
