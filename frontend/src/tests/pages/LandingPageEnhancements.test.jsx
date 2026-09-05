import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Navbar } from "../../components/layout/Navbar";
import { EResources } from "../../sections/EResources";
import { CatalogSearch } from "../../sections/CatalogSearch";
import Landing from "../../pages/public/Landing";
import useAuthStore from "../../store/authStore";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Landing Page Enhancements & Fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Setup global IntersectionObserver and ResizeObserver for jsdom
    if (typeof globalThis.IntersectionObserver === "undefined") {
      globalThis.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    if (typeof globalThis.ResizeObserver === "undefined") {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }

    // Default to unauthenticated user
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });
  });

  it("1. Navbar renders all navigation links targeting the correct sections", () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    // Verify desktop links
    expect(
      screen.getAllByRole("button", { name: /Features/i })[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /E-Resources/i })[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Catalog Search/i })[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Streaks/i })[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /How It Works/i })[0],
    ).toBeInTheDocument();
  });

  it("2. Navbar link click invokes scrollIntoView for target section", () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    // Create target section elements in DOM
    const featuresEl = document.createElement("section");
    featuresEl.id = "features";
    document.body.appendChild(featuresEl);

    const eresourcesEl = document.createElement("section");
    eresourcesEl.id = "e-resources";
    document.body.appendChild(eresourcesEl);

    const catalogEl = document.createElement("section");
    catalogEl.id = "catalog-search";
    document.body.appendChild(catalogEl);

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    const eresourcesBtn = screen.getAllByRole("button", {
      name: /E-Resources/i,
    })[0];
    fireEvent.click(eresourcesBtn);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

    const catalogBtn = screen.getAllByRole("button", {
      name: /Catalog Search/i,
    })[0];
    fireEvent.click(catalogBtn);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

    // Clean up DOM
    featuresEl.remove();
    eresourcesEl.remove();
    catalogEl.remove();
  });

  it("3. 'Browse the Library' CTA in EResources scrolls to the Catalog Search section", () => {
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
    expect(browseBtn).toBeInTheDocument();
    fireEvent.click(browseBtn);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

    catalogSection.remove();
  });

  it("4. EResources section displays horizontal book carousel and clicking a card redirects unauthenticated users to /auth/login", () => {
    render(
      <MemoryRouter>
        <EResources />
      </MemoryRouter>,
    );

    const carousel = screen.getByTestId("eresources-carousel");
    expect(carousel).toBeInTheDocument();

    const bookCards = screen.getAllByTestId("eresources-book-card");
    expect(bookCards.length).toBeGreaterThan(0);

    // Clicking a book card redirects to /auth/login
    fireEvent.click(bookCards[0]);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/auth/login",
      expect.objectContaining({
        state: expect.objectContaining({ from: "e-resources" }),
      }),
    );
  });

  it("5. CatalogSearch section displays horizontal book carousel and clicking a card redirects unauthenticated users to /auth/login", () => {
    render(
      <MemoryRouter>
        <CatalogSearch />
      </MemoryRouter>,
    );

    const carousel = screen.getByTestId("catalog-carousel");
    expect(carousel).toBeInTheDocument();

    const bookCards = screen.getAllByTestId("catalog-book-card");
    expect(bookCards.length).toBeGreaterThan(0);

    // Clicking a book card redirects to /auth/login
    fireEvent.click(bookCards[0]);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/auth/login",
      expect.objectContaining({
        state: expect.objectContaining({ from: "catalog-search" }),
      }),
    );
  });

  it("6. Landing page renders both EResources and CatalogSearch sections with carousels", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("eresources-carousel")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-carousel")).toBeInTheDocument();
  });
});
