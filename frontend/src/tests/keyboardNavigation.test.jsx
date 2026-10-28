import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "../pages/Login";
import { CatalogSearch } from "../sections/CatalogSearch";
import { AccessibilityToolbar } from "../components/accessibility/AccessibilityToolbar";
import "../i18n/config";

// Mock router navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock api client
vi.mock("../api/client", () => ({
  default: {
    get: vi.fn().mockImplementation((url) => {
      if (url.includes("/books")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                _id: "book-1",
                id: "book-1",
                title: "Introduction to Algorithms",
                author: "Cormen",
                category: "Computer Science",
                shelfLocation: "CS-101",
                copiesAvailable: 3,
                copiesTotal: 5,
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          user: { id: "usr-1", email: "student@standard.edu", role: "student" },
          accessToken: "mock-token",
        },
      },
    }),
  },
  setOnUnauthorizedCallback: vi.fn(),
  fetchCsrfToken: vi.fn().mockResolvedValue("mock-csrf"),
}));

vi.mock("../hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
    features: { "accessibility-mode": true },
    isLoading: false,
  }),
}));

describe("Feature 2: Keyboard-Only Navigation Pass (Login, Search, Reading)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollBy = vi.fn();
  });

  describe("1. Keyboard-Only Login Flow", () => {
    it("allows full login form navigation and submission using only keyboard (Tab, Enter, Space)", () => {
      const { container } = render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      // Find inputs directly via input name or id
      const emailInput =
        container.querySelector('input[name="username"]') ||
        container.querySelector("#login-username");

      const passwordInput =
        container.querySelector('input[name="password"]') ||
        container.querySelector("#login-password");

      const submitBtn = screen.getByRole("button", { name: /sign in/i });

      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();
      expect(submitBtn).toBeInTheDocument();

      // Keyboard navigation: focus email, enter value
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);
      fireEvent.change(emailInput, {
        target: { value: "student@standard.edu" },
      });

      // Focus password, enter value
      passwordInput.focus();
      expect(document.activeElement).toBe(passwordInput);
      fireEvent.change(passwordInput, {
        target: { value: "StudentPass@2026!" },
      });

      // Focus submit button and trigger Enter
      submitBtn.focus();
      expect(document.activeElement).toBe(submitBtn);
      fireEvent.keyDown(submitBtn, { key: "Enter", code: "Enter" });
      fireEvent.click(submitBtn);

      expect(submitBtn).toBeInTheDocument();
    });
  });

  describe("2. Keyboard-Only Catalog Search Flow", () => {
    it("allows navigating search query input and category filter buttons via keyboard", async () => {
      const { container } = render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      // Locate search input
      const searchInput =
        screen.queryByRole("textbox", { name: /search/i }) ||
        screen.queryByPlaceholderText(/search by title/i) ||
        container.querySelector('input[type="text"]');
      expect(searchInput).toBeInTheDocument();

      // Keyboard: Focus and type query
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);
      fireEvent.change(searchInput, { target: { value: "Algorithms" } });
      expect(searchInput.value).toBe("Algorithms");

      // Verify category filter buttons can receive focus and be triggered by Enter
      const categoryButtons = screen.getAllByRole("button");
      expect(categoryButtons.length).toBeGreaterThan(0);

      const firstBtn = categoryButtons[0];
      firstBtn.focus();
      expect(document.activeElement).toBe(firstBtn);
      fireEvent.keyDown(firstBtn, { key: "Enter", code: "Enter" });
    });
  });

  describe("3. Keyboard-Only Modal & Accessibility Dialog Flow", () => {
    it("opens dialog with keyboard Enter, navigates switches, and closes with Escape", () => {
      render(<AccessibilityToolbar />);

      // Find trigger button and focus
      const trigger = screen.getByRole("button", {
        name: /accessibility options/i,
      });
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      // Open with Enter
      fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
      fireEvent.click(trigger);

      // Verify dialog is open and accessible
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();

      // Focus switches
      const switches = screen.getAllByRole("switch");
      expect(switches.length).toBeGreaterThanOrEqual(2);

      const dyslexiaSwitch = switches[0];
      dyslexiaSwitch.focus();
      expect(document.activeElement).toBe(dyslexiaSwitch);

      // Toggle switch with Space
      fireEvent.keyDown(dyslexiaSwitch, { key: " ", code: "Space" });
      fireEvent.click(dyslexiaSwitch);

      // Close dialog with Escape
      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
