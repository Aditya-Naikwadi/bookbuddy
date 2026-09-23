import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Login from "../../pages/Login";
import Register from "../../pages/Register";
import { registrationApi } from "../../api/registrationApi";
import useAuthStore from "../../store/authStore";
import * as tenantUtils from "../../utils/tenantSubdomain";
import apiClient from "../../api/client";

vi.mock("../../context/ConfigContext", () => ({
  useConfig: () => ({
    googleClientId: "",
  }),
}));

const mockActiveColleges = [
  {
    _id: "college-1",
    name: "Massachusetts Institute of Technology",
    shortName: "MIT",
    code: "MIT",
    slug: "mit",
    domain: "mit.edu",
    status: "active",
    isActive: true,
  },
  {
    _id: "college-2",
    name: "Stanford University",
    shortName: "Stanford",
    code: "STAN",
    slug: "stanford",
    domain: "stanford.edu",
    status: "active",
    isActive: true,
  },
  {
    _id: "college-3",
    name: "Oxford University",
    shortName: "Oxford",
    code: "OXF",
    slug: "oxford",
    domain: "ox.ac.uk",
    status: "active",
    isActive: true,
  },
];

describe("@testing-accessibility-auditor: WCAG 2.1.1 Full Keyboard-Only Navigation & Combobox Accessibility", () => {
  let originalLocation;

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe("1. Login.jsx College Combobox (WCAG 2.1.1 Keyboard Navigation)", () => {
    it("provides correct ARIA combobox attributes and supports full ArrowDown / ArrowUp / Enter / Escape navigation", async () => {
      vi.spyOn(tenantUtils, "getSubdomainTenantSlug").mockReturnValue(null);
      vi.spyOn(registrationApi, "getActiveColleges").mockResolvedValue(
        mockActiveColleges,
      );

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      const combobox = screen.getByRole("combobox", {
        name: /Search college institution/i,
      });
      expect(combobox).toBeInTheDocument();
      expect(combobox).toHaveAttribute("aria-expanded", "false");
      expect(combobox).toHaveAttribute("aria-haspopup", "listbox");
      expect(combobox).toHaveAttribute(
        "aria-controls",
        "college-picker-options",
      );
      expect(combobox).toHaveAttribute("aria-autocomplete", "list");

      // Wait for colleges to load
      await waitFor(() => {
        expect(combobox).not.toBeDisabled();
      });

      // 1. ArrowDown opens listbox and selects first item (MIT)
      fireEvent.keyDown(combobox, { key: "ArrowDown" });

      expect(combobox).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(3);

      // Verify active descendant is set to MIT
      expect(combobox).toHaveAttribute(
        "aria-activedescendant",
        "login-college-opt-college-1",
      );
      expect(options[0]).toHaveAttribute("aria-selected", "true");
      expect(options[1]).toHaveAttribute("aria-selected", "false");

      // 2. ArrowDown moves to second item (Stanford)
      fireEvent.keyDown(combobox, { key: "ArrowDown" });
      expect(combobox).toHaveAttribute(
        "aria-activedescendant",
        "login-college-opt-college-2",
      );
      expect(options[0]).toHaveAttribute("aria-selected", "false");
      expect(options[1]).toHaveAttribute("aria-selected", "true");

      // 3. ArrowDown moves to third item (Oxford)
      fireEvent.keyDown(combobox, { key: "ArrowDown" });
      expect(combobox).toHaveAttribute(
        "aria-activedescendant",
        "login-college-opt-college-3",
      );
      expect(options[2]).toHaveAttribute("aria-selected", "true");

      // 4. ArrowDown wraps back to first item (MIT)
      fireEvent.keyDown(combobox, { key: "ArrowDown" });
      expect(combobox).toHaveAttribute(
        "aria-activedescendant",
        "login-college-opt-college-1",
      );
      expect(options[0]).toHaveAttribute("aria-selected", "true");

      // 5. ArrowUp wraps to last item (Oxford)
      fireEvent.keyDown(combobox, { key: "ArrowUp" });
      expect(combobox).toHaveAttribute(
        "aria-activedescendant",
        "login-college-opt-college-3",
      );
      expect(options[2]).toHaveAttribute("aria-selected", "true");

      // 6. Escape closes listbox
      fireEvent.keyDown(combobox, { key: "Escape" });
      expect(combobox).toHaveAttribute("aria-expanded", "false");
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      // 7. ArrowDown re-opens, ArrowDown to Stanford, Enter selects and redirects
      fireEvent.keyDown(combobox, { key: "ArrowDown" }); // opens at index 0 (MIT)
      fireEvent.keyDown(combobox, { key: "ArrowDown" }); // moves to index 1 (Stanford)

      fireEvent.keyDown(combobox, { key: "Enter" });

      expect(
        window.location.href === "https://stanford.bookbuddy.com/login" ||
          window.location.assign.mock.calls.some(
            (call) => call[0] === "https://stanford.bookbuddy.com/login",
          ),
      ).toBe(true);

      expect(
        screen.getByText(/Redirecting to Stanford University portal/i),
      ).toBeInTheDocument();
    });
  });

  describe("2. Register.jsx College Combobox (WCAG 2.1.1 Keyboard Navigation)", () => {
    it("provides correct ARIA combobox attributes and supports full keyboard selection into the registration form", async () => {
      vi.spyOn(registrationApi, "getActiveColleges").mockResolvedValue(
        mockActiveColleges,
      );

      vi.spyOn(apiClient, "get").mockImplementation((url) => {
        if (url.includes("csrf")) {
          return Promise.resolve({ data: { csrfToken: "csrf-token" } });
        }
        return Promise.resolve({ data: {} });
      });

      const postSpy = vi.spyOn(apiClient, "post").mockImplementation((url) => {
        if (url.includes("csrf")) {
          return Promise.resolve({ data: { csrfToken: "csrf-token" } });
        }
        if (url === "/auth/register") {
          return Promise.resolve({
            data: {
              success: true,
              accessToken: "token-123",
              user: {
                _id: "u-1",
                name: "Alex Smith",
                email: "alex@stanford.edu",
                role: "student",
                studentId: "STU-999",
                collegeId: "college-2",
              },
            },
          });
        }
        return Promise.resolve({ data: {} });
      });

      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>,
      );

      // Switch to College Student
      const studentRadio = screen.getByLabelText(/College Student/i);
      fireEvent.click(studentRadio);

      const combobox = await screen.findByRole("combobox", {
        name: /Select Institution/i,
      });
      expect(combobox).toBeInTheDocument();
      expect(combobox).toHaveAttribute("aria-expanded", "false");
      expect(combobox).toHaveAttribute("aria-haspopup", "listbox");
      expect(combobox).toHaveAttribute("aria-controls", "college-options-list");
      expect(combobox).toHaveAttribute("aria-autocomplete", "list");

      // 1. ArrowDown opens listbox
      fireEvent.keyDown(combobox, { key: "ArrowDown" });
      expect(combobox).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(3);
      expect(combobox).toHaveAttribute(
        "aria-activedescendant",
        "reg-college-opt-college-1",
      );
      expect(options[0]).toHaveAttribute("aria-selected", "true");

      // 2. Escape closes listbox
      fireEvent.keyDown(combobox, { key: "Escape" });
      expect(combobox).toHaveAttribute("aria-expanded", "false");
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      // 3. ArrowDown re-opens, ArrowDown to Stanford (index 1), Enter selects Stanford
      fireEvent.keyDown(combobox, { key: "ArrowDown" });
      fireEvent.keyDown(combobox, { key: "ArrowDown" });
      expect(combobox).toHaveAttribute(
        "aria-activedescendant",
        "reg-college-opt-college-2",
      );

      fireEvent.keyDown(combobox, { key: "Enter" });

      // Listbox closes upon Enter selection
      expect(combobox).toHaveAttribute("aria-expanded", "false");
      expect(combobox.value).toBe("Stanford University");

      // Complete registration form
      fireEvent.change(screen.getByLabelText(/Full Name/i), {
        target: { value: "Alex Smith" },
      });
      fireEvent.change(screen.getByLabelText(/Email/i), {
        target: { value: "alex@stanford.edu" },
      });
      fireEvent.change(screen.getByLabelText(/ID Number/i), {
        target: { value: "STU-999" },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: "StrongP@ssw0rd!" },
      });

      const submitBtn = screen.getByRole("button", { name: /Create Account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith(
          "/auth/register",
          expect.objectContaining({
            name: "Alex Smith",
            email: "alex@stanford.edu",
            role: "student",
            studentId: "STU-999",
            collegeId: "college-2",
          }),
        );
      });
    });
  });
});
