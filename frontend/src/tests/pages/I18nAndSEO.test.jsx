import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import i18n from "../../i18n/config";
import { Navbar } from "../../components/layout/Navbar";
import { Hero } from "../../sections/Hero";
import NotFound from "../../pages/public/NotFound";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock authStore
vi.mock("../../store/authStore", () => ({
  default: () => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

describe("Checklist 10 & 11: Internationalization and SEO & Social Sharing", () => {
  beforeEach(() => {
    localStorage.clear();
    i18n.changeLanguage("en");
    document.documentElement.lang = "en";

    // JSDOM Mocks
    globalThis.IntersectionObserver = class IntersectionObserver {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollBy = vi.fn();
  });

  afterEach(() => {
    i18n.changeLanguage("en");
  });

  describe("10. Internationalization", () => {
    it("1. Language switcher works and persists choice in localStorage and document.documentElement.lang", async () => {
      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      const desktopSelect = screen.getByLabelText("Select language", {
        selector: "#desktop-language-select",
      });
      expect(desktopSelect).toBeInTheDocument();
      expect(desktopSelect.value).toBe("en");

      // Switch to Hindi (hi)
      await i18n.changeLanguage("hi");
      fireEvent.change(desktopSelect, { target: { value: "hi" } });
      await waitFor(() => {
        expect(i18n.language).toBe("hi");
        expect(localStorage.getItem("language")).toBe("hi");
        expect(document.documentElement.lang).toBe("hi");
      });

      // Switch to Marathi (mr)
      await i18n.changeLanguage("mr");
      fireEvent.change(desktopSelect, { target: { value: "mr" } });
      await waitFor(() => {
        expect(i18n.language).toBe("mr");
        expect(localStorage.getItem("language")).toBe("mr");
        expect(document.documentElement.lang).toBe("mr");
      });

      // Switch to Spanish (es)
      await i18n.changeLanguage("es");
      fireEvent.change(desktopSelect, { target: { value: "es" } });
      await waitFor(() => {
        expect(i18n.language).toBe("es");
        expect(localStorage.getItem("language")).toBe("es");
        expect(document.documentElement.lang).toBe("es");
      });
    });

    it("2. All landing hero strings update when language changes without hardcoded English left", async () => {
      const { rerender } = render(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      // In English
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        /The Library in/i,
      );
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        /Your Pocket/i,
      );

      // Switch to Hindi
      await i18n.changeLanguage("hi");
      rerender(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        /आपकी जेब में/i,
      );
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        /पूरी लाइब्रेरी/i,
      );
      expect(screen.getByText("लाइब्रेरी देखें →")).toBeInTheDocument();

      // Switch to Marathi
      await i18n.changeLanguage("mr");
      rerender(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        /तुमच्या खिशात/i,
      );
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        /संपूर्ण ग्रंथालय/i,
      );
      expect(screen.getByText("ग्रंथालय पहा →")).toBeInTheDocument();
    });

    it("3. Navbar navigation links translate correctly in Hindi and Marathi", async () => {
      const { rerender } = render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      // In English (both desktop and drawer render items)
      expect(screen.getAllByText("Catalog Search").length).toBeGreaterThan(0);
      expect(screen.getAllByText("E-Resources").length).toBeGreaterThan(0);

      // In Hindi
      await i18n.changeLanguage("hi");
      rerender(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      expect(screen.getAllByText("कैटलॉग खोज").length).toBeGreaterThan(0);
      expect(screen.getAllByText("ई-संसाधन").length).toBeGreaterThan(0);
      expect(screen.getAllByText("साइन इन").length).toBeGreaterThan(0);
      expect(screen.getAllByText("मुफ्त शुरू करें").length).toBeGreaterThan(0);

      // In Marathi
      await i18n.changeLanguage("mr");
      rerender(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      expect(screen.getAllByText("कॅटलॉग शोध").length).toBeGreaterThan(0);
      expect(screen.getAllByText("ई-संसाधने").length).toBeGreaterThan(0);
      expect(screen.getAllByText("साइन इन").length).toBeGreaterThan(0);
      expect(screen.getAllByText("मोफत सुरू करा").length).toBeGreaterThan(0);
    });
  });

  describe("11. SEO & Social Sharing", () => {
    const indexPath = path.resolve(__dirname, "../../../index.html");
    const robotsPath = path.resolve(__dirname, "../../../public/robots.txt");
    const sitemapPath = path.resolve(__dirname, "../../../public/sitemap.xml");

    it("1. index.html contains unique title, meta description, and canonical URL", () => {
      const html = fs.readFileSync(indexPath, "utf-8");
      expect(html).toContain(
        "<title>BookBuddy — The Library in Your Pocket</title>",
      );
      expect(html).toContain('name="description"');
      expect(html).toContain('rel="canonical" href="https://bookbuddy.app/"');
    });

    it("2. index.html contains full Open Graph and Twitter Card tags with preview image", () => {
      const html = fs.readFileSync(indexPath, "utf-8");
      expect(html).toContain('property="og:title"');
      expect(html).toContain('property="og:description"');
      expect(html).toContain(
        'property="og:url" content="https://bookbuddy.app/"',
      );
      expect(html).toContain(
        'property="og:image" content="https://bookbuddy.app/og-image.png"',
      );
      expect(html).toContain(
        'name="twitter:card" content="summary_large_image"',
      );
      expect(html).toContain(
        'name="twitter:image" content="https://bookbuddy.app/og-image.png"',
      );
    });

    it("3. index.html contains Schema.org JSON-LD structured data for WebSite and Organization", () => {
      const html = fs.readFileSync(indexPath, "utf-8");
      expect(html).toContain('type="application/ld+json"');
      expect(html).toContain('"@type": "WebSite"');
      expect(html).toContain('"@type": "Organization"');
      expect(html).toContain('"https://bookbuddy.app/"');
    });

    it("4. index.html contains noscript fallback markup for search engine crawlers", () => {
      const html = fs.readFileSync(indexPath, "utf-8");
      expect(html).toContain("<noscript>");
      expect(html).toContain("BookBuddy — The Library in Your Pocket");
      expect(html).toContain('href="/#catalog-search"');
      expect(html).toContain('href="/#e-resources"');
      expect(html).toContain("</noscript>");
    });

    it("5. robots.txt and sitemap.xml exist and configure crawl directives correctly", () => {
      const robots = fs.readFileSync(robotsPath, "utf-8");
      expect(robots).toContain("User-agent: *");
      expect(robots).toContain("Allow: /");
      expect(robots).toContain("Disallow: /admin-portal");
      expect(robots).toContain("Sitemap: https://bookbuddy.app/sitemap.xml");

      const sitemap = fs.readFileSync(sitemapPath, "utf-8");
      expect(sitemap).toContain("<urlset");
      expect(sitemap).toContain("<loc>https://bookbuddy.app/</loc>");
      expect(sitemap).toContain(
        "<loc>https://bookbuddy.app/#catalog-search</loc>",
      );
    });

    it("6. 404 page renders properly with helpful home and catalog actions", () => {
      render(
        <MemoryRouter>
          <NotFound />
        </MemoryRouter>,
      );

      expect(
        screen.getByText("Lost in the Library Stacks?"),
      ).toBeInTheDocument();
      expect(screen.getByText("ERROR 404")).toBeInTheDocument();
      expect(screen.getByText("Return to Home")).toBeInTheDocument();
      expect(screen.getByText("Browse Catalog")).toBeInTheDocument();
    });
  });
});
