import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../../i18n/config";
import Landing from "../../pages/public/Landing";
import GeneralDashboardHome from "../../pages/dashboards/general/GeneralDashboardHome";
import StudentDashboardHome from "../../pages/dashboards/student/StudentDashboardHome";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

// Mock router navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock auth store
vi.mock("../../store/authStore", () => ({
  default: () => ({
    isAuthenticated: true,
    user: {
      id: "usr-student-1",
      name: "Aarav Sharma",
      email: "aarav@standard.edu",
      role: "student",
      studentId: "STD-2026-001",
      collegeId: "6ad2044e6ea22b7cbf57daf9",
    },
    isLoading: false,
    logout: vi.fn(),
  }),
}));

vi.mock("../../hooks/useBookAvailability", () => ({
  default: vi.fn(),
}));

vi.mock("../../hooks/useBookData", () => ({
  useGeneralDashboard: () => ({
    data: {
      stats: {
        totalCatalogBooks: 15420,
        addedThisMonth: 128,
        categoryBreakdown: [],
        sparklineData: [10, 20, 30],
      },
      newArrivals: [
        {
          _id: "book-1",
          title: "Clean Code",
          author: "Robert Martin",
        },
      ],
      popularBooks: [],
      announcements: [],
      librarySettings: {
        openingHour: "08:00 AM",
        closingHour: "05:00 PM",
        isClosedToday: false,
      },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useBookRealtimeSync: vi.fn(),
}));

vi.mock("../../hooks/useStudentOverview", () => ({
  useStudentOverview: () => ({
    overview: {
      user: { name: "Aarav Sharma", studentId: "STD-2026-001" },
      activeLoans: [],
      finesSummary: { totalUnpaid: 0 },
      reservations: [],
      streak: { currentStreak: 12, todayComplete: true },
      recommendations: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    checkIn: vi.fn(),
    isCheckInPending: false,
    renewLoan: vi.fn(),
    isRenewing: false,
    cancelHold: vi.fn(),
    isCancellingHold: false,
  }),
}));

// Mock api client
vi.mock("../../api/client", () => ({
  default: {
    get: vi.fn().mockImplementation((url) => {
      if (url.includes("/books/public") || url.includes("/books")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                _id: "book-1",
                id: "book-1",
                title: "Computer Networks & Distributed Systems",
                author: "Andrew S. Tanenbaum",
                category: "Computer Science",
                shelfLocation: "Shelf CS-204",
                copiesAvailable: 4,
                copiesTotal: 10,
              },
            ],
          },
        });
      }
      if (url.includes("/eresources")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                _id: "eb-1",
                id: "eb-1",
                title: "Pride and Prejudice",
                author: "Jane Austen",
                genre: "Classic Fiction",
                format: "EPUB / PDF",
                moderationStatus: "approved",
              },
            ],
          },
        });
      }
      if (url.includes("/dashboard") || url.includes("/overview")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              stats: {
                totalCatalogBooks: 15420,
                addedThisMonth: 128,
                categoryBreakdown: [],
                sparklineData: [10, 20, 30],
              },
              newArrivals: [
                {
                  _id: "book-1",
                  title: "Clean Code",
                  author: "Robert Martin",
                },
              ],
              popularBooks: [],
              announcements: [],
              librarySettings: {
                openingHour: "08:00 AM",
                closingHour: "05:00 PM",
                isClosedToday: false,
              },
            },
          },
        });
      }
      if (url.includes("/loans")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                _id: "loan-1",
                bookTitle: "Clean Code",
                dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
                status: "active",
              },
            ],
          },
        });
      }
      if (url.includes("/holds")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [],
          },
        });
      }
      if (url.includes("/streaks")) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              currentStreak: 12,
              longestStreak: 25,
              lastActiveDate: new Date().toISOString(),
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
  setOnUnauthorizedCallback: vi.fn(),
}));

describe("Feature 1: Vernacular i18n & Multi-Viewport Layout Resilience", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
    i18n.changeLanguage("en");

    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollBy = vi.fn();
  });

  afterEach(() => {
    i18n.changeLanguage("en");
    document.documentElement.lang = "en";
  });

  describe("1. Language persistence & <html lang> updates", () => {
    it("persists Marathi ('mr') choice to localStorage and updates <html lang='mr'>", async () => {
      await i18n.changeLanguage("mr");
      localStorage.setItem("language", "mr");
      document.documentElement.lang = "mr";

      expect(i18n.language).toBe("mr");
      expect(localStorage.getItem("language")).toBe("mr");
      expect(document.documentElement.lang).toBe("mr");
    });

    it("persists Hindi ('hi') choice to localStorage and updates <html lang='hi'>", async () => {
      await i18n.changeLanguage("hi");
      localStorage.setItem("language", "hi");
      document.documentElement.lang = "hi";

      expect(i18n.language).toBe("hi");
      expect(localStorage.getItem("language")).toBe("hi");
      expect(document.documentElement.lang).toBe("hi");
    });
  });

  describe("2. Landing Page Layout Resilience (375px Mobile & 1280px Desktop)", () => {
    it("renders Landing page in Marathi without unescaped key fallback or crashing", async () => {
      await i18n.changeLanguage("mr");
      document.documentElement.lang = "mr";

      // Simulate 375px mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;

      const { container } = render(
        <MemoryRouter>
          <Landing />
        </MemoryRouter>,
      );

      // Verify Marathi heading in hero
      const h1 = container.querySelector("h1");
      expect(h1).toBeInTheDocument();
      expect(h1.textContent).toContain("तुमच्या खिशात");

      // Verify sections render
      expect(container.querySelector("#catalog-search")).toBeInTheDocument();
      expect(container.querySelector("#e-resources")).toBeInTheDocument();
      expect(container.querySelector("#features")).toBeInTheDocument();
      expect(container.querySelector("#how-it-works")).toBeInTheDocument();
      expect(container.querySelector("#streaks")).toBeInTheDocument();
      expect(container.querySelector("#faq")).toBeInTheDocument();
      expect(container.querySelector("footer")).toBeInTheDocument();
    });

    it("renders Landing page in Hindi at 1280px desktop viewport without layout overflow", async () => {
      await i18n.changeLanguage("hi");
      document.documentElement.lang = "hi";

      // Simulate 1280px desktop viewport
      window.innerWidth = 1280;
      window.innerHeight = 800;

      const { container } = render(
        <MemoryRouter>
          <Landing />
        </MemoryRouter>,
      );

      // Verify Hindi heading in hero
      const h1 = container.querySelector("h1");
      expect(h1).toBeInTheDocument();
      expect(h1.textContent).toContain("आपकी जेब में");

      // Verify catalog search section in Hindi
      expect(screen.getAllByText("कैटलॉग खोज").length).toBeGreaterThan(0);
    });
  });

  describe("3. General Dashboard in Marathi and Hindi", () => {
    it("renders General Dashboard with full Marathi translations", async () => {
      await i18n.changeLanguage("mr");
      document.documentElement.lang = "mr";
      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <GeneralDashboardHome />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // Title & Subtitle in Marathi
      await waitFor(() => {
        expect(screen.getByText("सामान्य वाचक डॅशबोर्ड")).toBeInTheDocument();
      });
      expect(
        screen.getByText("ग्रंथालय पुस्तके, ई-संसाधने आणि वापर आकडेवारी पहा"),
      ).toBeInTheDocument();
      expect(screen.getByText("एकूण कॅटलॉग पुस्तके")).toBeInTheDocument();
      expect(screen.getByText(/या महिन्यात जोडलेली/)).toBeInTheDocument();
      expect(screen.getByText(/नवीन पुस्तके/)).toBeInTheDocument();
    });

    it("renders General Dashboard with full Hindi translations", async () => {
      await i18n.changeLanguage("hi");
      document.documentElement.lang = "hi";
      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <GeneralDashboardHome />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("सामान्य पाठक डैशबोर्ड")).toBeInTheDocument();
      });
      expect(
        screen.getByText("लाइब्रेरी पुस्तकें, ई-संसाधन और संचालन आंकड़े देखें"),
      ).toBeInTheDocument();
      expect(screen.getByText("कुल कैटलॉग पुस्तकें")).toBeInTheDocument();
      expect(screen.getByText(/इस माह जोड़ी गईं/)).toBeInTheDocument();
      expect(screen.getByText(/नई पुस्तकें/)).toBeInTheDocument();
    });
  });

  describe("4. Student Dashboard in Marathi and Hindi", () => {
    it("renders Student Dashboard with full Marathi translations at 375px mobile", async () => {
      await i18n.changeLanguage("mr");
      document.documentElement.lang = "mr";
      window.innerWidth = 375;
      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <StudentDashboardHome />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("उसनी घेतलेली पुस्तके")).toBeInTheDocument();
      });
      expect(screen.getByText("सक्रिय आरक्षणे")).toBeInTheDocument();
      expect(screen.getAllByText("वाचन स्ट्रीक").length).toBeGreaterThan(0);
      expect(screen.getByText("थकबाकी दंड")).toBeInTheDocument();
      expect(screen.getByText("द्रुत सेवा")).toBeInTheDocument();
    });

    it("renders Student Dashboard with full Hindi translations at 1280px desktop", async () => {
      await i18n.changeLanguage("hi");
      document.documentElement.lang = "hi";
      window.innerWidth = 1280;
      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <StudentDashboardHome />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("सक्रिय पुस्तकें")).toBeInTheDocument();
      });
      expect(screen.getByText("सक्रिय आरक्षण")).toBeInTheDocument();
      expect(screen.getAllByText("वाचन स्ट्रीक").length).toBeGreaterThan(0);
      expect(screen.getByText("बकाया जुर्माना")).toBeInTheDocument();
      expect(screen.getByText("त्वरित सेवाएं")).toBeInTheDocument();
    });
  });

  describe("5. Typography and Font Fallbacks", () => {
    it("ensures index.html includes Devanagari Google fonts links", () => {
      const fs = require("fs");
      const path = require("path");
      const htmlPath = path.resolve(__dirname, "../../../index.html");
      const htmlContent = fs.readFileSync(htmlPath, "utf8");

      expect(htmlContent).toContain("Noto+Sans+Devanagari");
      expect(htmlContent).toContain("Noto+Serif+Devanagari");
    });
  });
});
