import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe from "axe-core";
import { AccessibilityToolbar } from "../components/accessibility/AccessibilityToolbar";
import { useAccessibilityStore } from "../store/accessibilityStore";
import Login from "../pages/Login";
import GeneralDashboardHome from "../pages/dashboards/general/GeneralDashboardHome";
import StudentDashboardHome from "../pages/dashboards/student/StudentDashboardHome";
import "../i18n/config";

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
let mockCurrentUser = {
  id: "usr-student-1",
  name: "Aarav Sharma",
  email: "aarav@standard.edu",
  role: "student",
  studentId: "STD-2026-001",
  collegeId: "6ad2044e6ea22b7cbf57daf9",
};

vi.mock("../store/authStore", () => ({
  default: () => ({
    isAuthenticated: true,
    user: mockCurrentUser,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

vi.mock("../hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: (_flag) => {
      // By default accessibility-mode is active in tests
      return true;
    },
    features: {
      "accessibility-mode": true,
      "vernacular-i18n": true,
    },
    isLoading: false,
  }),
}));

vi.mock("../hooks/useBookAvailability", () => ({
  default: vi.fn(),
}));

vi.mock("../hooks/useBookData", () => ({
  useGeneralDashboard: () => ({
    data: {
      stats: {
        totalCatalogBooks: 15420,
        addedThisMonth: 128,
        categoryBreakdown: [],
        sparklineData: [10, 20, 30],
      },
      newArrivals: [],
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

vi.mock("../hooks/useStudentOverview", () => ({
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

vi.mock("../api/client", () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { success: true, data: [] },
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    patch: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
  setOnUnauthorizedCallback: vi.fn(),
}));

describe("Feature 2: Accessibility Mode (WCAG 2.1 AA & Axe Verification)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    document.documentElement.className = "";

    // Reset speech mock
    window.speechSynthesis = {
      speak: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
    };
    window.SpeechSynthesisUtterance = class MockSpeechSynthesisUtterance {
      constructor(text) {
        this.text = text;
        this.rate = 1;
        this.pitch = 1;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
        this.onpause = null;
        this.onresume = null;
      }
    };

    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollBy = vi.fn();

    useAccessibilityStore.getState().resetPreferences();
    useAccessibilityStore.getState().closeToolbar();
  });

  afterEach(() => {
    document.body.className = "";
    document.documentElement.className = "";
  });

  describe("1. Per-User Setting Persistence & DOM Token Updates", () => {
    it("persists dyslexiaFont and highContrast per user in localStorage and toggles DOM classes", () => {
      useAccessibilityStore.getState().setUserId("usr-student-1");

      // Initially off
      expect(document.body.classList.contains("dyslexia-font")).toBe(false);
      expect(document.documentElement.classList.contains("high-contrast")).toBe(
        false,
      );

      // Toggle Dyslexia Font
      act(() => {
        useAccessibilityStore.getState().toggleDyslexiaFont();
      });
      expect(useAccessibilityStore.getState().dyslexiaFont).toBe(true);
      expect(document.body.classList.contains("dyslexia-font")).toBe(true);

      // Toggle High Contrast
      act(() => {
        useAccessibilityStore.getState().toggleHighContrast();
      });
      expect(useAccessibilityStore.getState().highContrast).toBe(true);
      expect(document.documentElement.classList.contains("high-contrast")).toBe(
        true,
      );

      // Verify localStorage is namespaced by userId
      const savedUser1 = JSON.parse(
        localStorage.getItem("bookbuddy_a11y_usr-student-1"),
      );
      expect(savedUser1.dyslexiaFont).toBe(true);
      expect(savedUser1.highContrast).toBe(true);

      // Switch to User 2: Should have isolated empty settings
      act(() => {
        useAccessibilityStore.getState().setUserId("usr-student-2");
      });
      expect(useAccessibilityStore.getState().dyslexiaFont).toBe(false);
      expect(useAccessibilityStore.getState().highContrast).toBe(false);
      expect(document.body.classList.contains("dyslexia-font")).toBe(false);
      expect(document.documentElement.classList.contains("high-contrast")).toBe(
        false,
      );
    });
  });

  describe("2. Web Speech API Text-to-Speech & Graceful Fallback", () => {
    it("reads content using Web Speech API when supported and sets speech rates", () => {
      useAccessibilityStore.setState({ isSpeechSupported: true });
      useAccessibilityStore.getState().setTtsRate(1.25);
      useAccessibilityStore
        .getState()
        .speakText("Welcome to BookBuddy Campus Library");

      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    });

    it("displays a clear alert message when Web Speech API is unsupported in browser", () => {
      // Simulate unsupported browser
      const origSynthesis = window.speechSynthesis;
      delete window.speechSynthesis;
      useAccessibilityStore.setState({ isSpeechSupported: false });

      render(<AccessibilityToolbar />);

      // Open toolbar
      const toggleBtn = screen.getByRole("button", {
        name: /accessibility options/i,
      });
      fireEvent.click(toggleBtn);

      // Toggle Text-to-Speech on
      const ttsSwitch = screen.getByRole("switch", { name: /text to speech/i });
      fireEvent.click(ttsSwitch);

      // Must display clear unsupported alert message
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toContain("Text-to-speech is not supported");

      // Restore
      window.speechSynthesis = origSynthesis;
      useAccessibilityStore.setState({ isSpeechSupported: true });
    });
  });

  describe("3. Axe-Core WCAG 2.1 AA Automated Audits (Zero Serious Violations)", () => {
    it("reports zero serious or critical axe violations on AccessibilityToolbar", async () => {
      const { container } = render(<AccessibilityToolbar />);

      // Open toolbar to test panel dialog
      const toggleBtn = screen.getByRole("button", {
        name: /accessibility options/i,
      });
      fireEvent.click(toggleBtn);

      const results = await axe.run(container);
      const seriousOrCritical = results.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact),
      );

      expect(
        seriousOrCritical,
        JSON.stringify(seriousOrCritical, null, 2),
      ).toEqual([]);
    });

    it("reports zero serious or critical axe violations on Login page", async () => {
      const { container } = render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      const results = await axe.run(container);
      const seriousOrCritical = results.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact),
      );

      expect(
        seriousOrCritical,
        JSON.stringify(seriousOrCritical, null, 2),
      ).toEqual([]);
    });

    it("reports zero serious or critical axe violations on General Dashboard", async () => {
      const queryClient = createTestQueryClient();
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <GeneralDashboardHome />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const results = await axe.run(container);
      const seriousOrCritical = results.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact),
      );

      expect(
        seriousOrCritical,
        JSON.stringify(seriousOrCritical, null, 2),
      ).toEqual([]);
    });

    it("reports zero serious or critical axe violations on Student Dashboard", async () => {
      const queryClient = createTestQueryClient();
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <StudentDashboardHome />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const results = await axe.run(container);
      const seriousOrCritical = results.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact),
      );

      expect(
        seriousOrCritical,
        JSON.stringify(seriousOrCritical, null, 2),
      ).toEqual([]);
    });
  });

  describe("4. Screen-Reader Landmarks & Keyboard Escape Handling", () => {
    it("renders AccessibilityToolbar as an accessible complementary landmark", () => {
      render(<AccessibilityToolbar />);
      const aside = screen.getByRole("complementary", {
        name: /accessibility options/i,
      });
      expect(aside).toBeInTheDocument();
    });

    it("closes accessibility dialog when Escape key is pressed", () => {
      render(<AccessibilityToolbar />);
      const toggleBtn = screen.getByRole("button", {
        name: /accessibility options/i,
      });
      fireEvent.click(toggleBtn);

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: "Escape" });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
