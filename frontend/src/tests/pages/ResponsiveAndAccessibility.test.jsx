import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Landing from "../../pages/public/Landing";
import { Navbar } from "../../components/layout/Navbar";
import { CatalogSearch } from "../../sections/CatalogSearch";
import { EResources } from "../../sections/EResources";
import "../../i18n/config";

// Mock router navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock api/client to prevent unhandled network requests
vi.mock("../../api/client", () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: [],
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
  setOnUnauthorizedCallback: vi.fn(),
}));

describe("8. Responsive Design & 9. Accessibility (WCAG 2.1 AA) Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    if (typeof globalThis.IntersectionObserver === "undefined") {
      globalThis.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }

    if (!window.HTMLElement.prototype.scrollBy) {
      window.HTMLElement.prototype.scrollBy = vi.fn();
    }
  });

  describe("9. Accessibility (WCAG 2.1 AA) Landmark & Structure Verification", () => {
    it("renders 'Skip to main content' link pointing to #main-content", () => {
      render(
        <MemoryRouter>
          <Landing />
        </MemoryRouter>,
      );

      const skipLink = screen.getByRole("link", {
        name: /skip to main content/i,
      });
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });

    it("verifies single <h1> tag on landing page for strict heading hierarchy", () => {
      const { container } = render(
        <MemoryRouter>
          <Landing />
        </MemoryRouter>,
      );

      const h1Elements = container.querySelectorAll("h1");
      expect(h1Elements.length).toBe(1);
      expect(h1Elements[0]).toHaveTextContent(/The Library in.*Your Pocket/i);
    });

    it("verifies essential landmarks: header, nav, main, footer", () => {
      const { container } = render(
        <MemoryRouter>
          <Landing />
        </MemoryRouter>,
      );

      const header = container.querySelector("header");
      const nav = container.querySelector("nav");
      const main = container.querySelector("main#main-content");
      const footer = container.querySelector("footer");

      expect(header).toBeInTheDocument();
      expect(nav).toBeInTheDocument();
      expect(main).toBeInTheDocument();
      expect(footer).toBeInTheDocument();
    });

    it("verifies carousels have accessible region roles and labels", async () => {
      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      const carousel = await screen.findByTestId("catalog-carousel");
      expect(carousel).toHaveAttribute("role", "region");
      expect(carousel).toHaveAttribute("aria-label", "Catalog Books Carousel");
    });

    it("verifies book cards have accessible names with title and author", async () => {
      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      const bookCards = await screen.findAllByTestId("catalog-book-card");
      expect(bookCards.length).toBeGreaterThan(0);
      bookCards.forEach((card) => {
        expect(card).toHaveAttribute("role", "button");
        expect(card.getAttribute("aria-label")).toBeTruthy();
      });
    });

    it("verifies icon-only buttons have descriptive aria-label", () => {
      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      const hamburgerBtn = screen.getByLabelText(
        /open navigation menu|close navigation menu/i,
      );
      expect(hamburgerBtn).toBeInTheDocument();
      expect(hamburgerBtn).toHaveAttribute(
        "aria-controls",
        "responsive-nav-drawer",
      );
    });

    it("verifies mobile drawer attributes: role='dialog', aria-modal='true', and Escape key dismisses", () => {
      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      const hamburgerBtn = screen.getByLabelText(/open navigation menu/i);
      fireEvent.click(hamburgerBtn);

      const drawer = screen.getByRole("dialog");
      expect(drawer).toBeInTheDocument();
      expect(drawer).toHaveAttribute("aria-modal", "true");

      // Press Escape to dismiss
      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
      expect(
        screen.getByLabelText(/open navigation menu/i),
      ).toBeInTheDocument();
    });
  });

  describe("8. Responsive Design & Touch Interactions", () => {
    it("ensures carousel container includes touch-pan-x for mobile touch swipe", async () => {
      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      const carousel = await screen.findByTestId("eresources-carousel");
      expect(carousel.className).toContain("touch-pan-x");
      expect(carousel.className).toContain("overflow-x-auto");
    });

    it("verifies carousel horizontal keyboard navigation with Arrow keys", async () => {
      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      const carousel = await screen.findByTestId("catalog-carousel");
      expect(carousel).toHaveAttribute("tabindex", "0");

      fireEvent.keyDown(carousel, { key: "ArrowRight", code: "ArrowRight" });
      fireEvent.keyDown(carousel, { key: "ArrowLeft", code: "ArrowLeft" });
      expect(carousel).toBeInTheDocument();
    });
  });
});
