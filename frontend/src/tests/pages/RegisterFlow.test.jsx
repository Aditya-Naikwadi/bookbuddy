import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Register from "../../pages/Register";
import apiClient from "../../api/client";
import { registrationApi } from "../../api/registrationApi";
import useAuthStore from "../../store/authStore";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../context/ConfigContext", () => ({
  useConfig: () => ({
    googleClientId: "",
  }),
}));

describe("Register Flow - General Patron Registration & Redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it("renders 3-option radio group with General Patron selected by default", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const generalRadio = screen.getByLabelText(/General Patron/i);
    const studentRadio = screen.getByLabelText(/College Student/i);
    const adminRadio = screen.getByLabelText(/College Admin/i);

    expect(generalRadio).toBeInTheDocument();
    expect(studentRadio).toBeInTheDocument();
    expect(adminRadio).toBeInTheDocument();

    expect(generalRadio).toBeChecked();
    expect(studentRadio).not.toBeChecked();
    expect(adminRadio).not.toBeChecked();
  });

  it("confirms General Patron registers with no college fields and redirects to General Dashboard", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockImplementation((url) => {
      if (url === "/auth/csrf-token" || url.includes("csrf")) {
        return Promise.resolve({ data: { csrfToken: "test-csrf" } });
      }
      if (url === "/auth/register") {
        return Promise.resolve({
          data: {
            success: true,
            accessToken: "mock-access-token",
            user: {
              _id: "patron-123",
              name: "Jane Doe",
              email: "jane@example.com",
              role: "general",
              collegeId: null,
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: "Password123!" },
    });

    const submitBtn = screen.getByRole("button", { name: /Create Account/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        "/auth/register",
        expect.objectContaining({
          name: "Jane Doe",
          email: "jane@example.com",
          password: "Password123!",
          role: "general",
        })
      );
    });

    // Verify absolutely NO college fields are sent in the payload
    const registerCall = postSpy.mock.calls.find((call) => call[0] === "/auth/register");
    expect(registerCall).toBeDefined();
    const payload = registerCall[1];
    expect(payload.collegeId).toBeUndefined();
    expect(payload.college).toBeUndefined();
    expect(payload.collegeSlug).toBeUndefined();
    expect(payload.collegeName).toBeUndefined();

    // Verify end-to-end redirect to /general-dashboard
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/general-dashboard", { replace: true });
    });
  });

  it("does not render the college dropdown when General Patron is selected", () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText(/Select Institution/i)).not.toBeInTheDocument();
  });

  it("reveals searchable dropdown populated only with active colleges and filters correctly when College Student is selected", async () => {
    const mockActiveColleges = [
      { _id: "c1", name: "Apex Engineering Institute", code: "APEX", domain: "apex.edu", status: "active" },
      { _id: "c2", name: "Beacon Arts University", code: "BAU", domain: "beacon.edu", status: "active" },
      { _id: "c3", name: "Crestview Medical College", code: "CMC", domain: "crestview.edu", status: "active" },
    ];

    const getCollegesSpy = vi.spyOn(registrationApi, "getActiveColleges").mockResolvedValue(mockActiveColleges);

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const studentRadio = screen.getByLabelText(/College Student/i);
    fireEvent.click(studentRadio);

    // Expect searchable dropdown input to appear
    await waitFor(() => {
      expect(screen.getByLabelText(/Select Institution/i)).toBeInTheDocument();
    });

    expect(getCollegesSpy).toHaveBeenCalled();

    const searchInput = screen.getByLabelText(/Select Institution/i);

    // Focus / open dropdown
    fireEvent.focus(searchInput);

    await waitFor(() => {
      expect(screen.getByText("Apex Engineering Institute")).toBeInTheDocument();
      expect(screen.getByText("Beacon Arts University")).toBeInTheDocument();
      expect(screen.getByText("Crestview Medical College")).toBeInTheDocument();
    });

    // Test filtering by typing 'Beacon'
    fireEvent.change(searchInput, { target: { value: "Beacon" } });

    await waitFor(() => {
      expect(screen.getByText("Beacon Arts University")).toBeInTheDocument();
      expect(screen.queryByText("Apex Engineering Institute")).not.toBeInTheDocument();
      expect(screen.queryByText("Crestview Medical College")).not.toBeInTheDocument();
    });

    // Select filtered college
    fireEvent.click(screen.getByText("Beacon Arts University"));

    // Dropdown closes and shows selected college
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(searchInput.value).toBe("Beacon Arts University");
    });
  });

  it("does not show a registration form and redirects to Tenant Onboarding flow (/register) when College Admin is selected", async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    // Verify initial form fields exist
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();

    const collegeAdminRadio = screen.getByLabelText(/College Admin/i);
    expect(collegeAdminRadio).toBeInTheDocument();

    // Select College Admin
    fireEvent.click(collegeAdminRadio);

    // Verify immediate redirect to /register
    expect(mockNavigate).toHaveBeenCalledWith("/register");

    // Verify registration form fields are NOT shown
    await waitFor(() => {
      expect(screen.queryByLabelText(/Full Name/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Email/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Password/i)).not.toBeInTheDocument();
      expect(screen.getByTestId("admin-redirect-state")).toBeInTheDocument();
    });
  });

  it("renders the student-facing Pending Approval screen with zero dashboard access when no roster match is found", async () => {
    vi.spyOn(registrationApi, "getActiveColleges").mockResolvedValue([
      { _id: "college-100", name: "Imperial Institute of Science", status: "active" },
    ]);

    vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        success: true,
        requiresApproval: true,
        status: "pending",
        message: "Join request submitted. Awaiting college administrator approval.",
        data: {
          requestId: "req-abc-123",
          studentId: "stu-offroster-42",
          name: "Pending Student",
          email: "pending.student@imperial.edu",
          collegeId: "college-100",
          collegeName: "Imperial Institute of Science",
          status: "pending",
          submittedAt: new Date().toISOString(),
        },
      },
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    // Switch to College Student
    fireEvent.click(screen.getByLabelText(/College Student/i));

    // Fill registration form
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Pending Student" },
    });
    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: "pending.student@imperial.edu" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "StrongPassword123!" },
    });

    // Select college
    const collegeInput = screen.getByLabelText(/Select Institution/i);
    fireEvent.focus(collegeInput);
    await waitFor(() => {
      expect(screen.getByText("Imperial Institute of Science")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Imperial Institute of Science"));

    // Enter Student ID
    fireEvent.change(screen.getByLabelText(/ID Number/i), {
      target: { value: "stu-offroster-42" },
    });

    // Submit form
    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    // Verify Pending Approval screen is displayed
    await waitFor(() => {
      expect(screen.getByTestId("student-pending-approval-screen")).toBeInTheDocument();
      expect(screen.getByText(/Join Request Submitted/i)).toBeInTheDocument();
      expect(screen.getByText(/Pending Administrator Approval/i)).toBeInTheDocument();
      expect(screen.getByText(/Locked Until Approved/i)).toBeInTheDocument();
    });

    // Verify ZERO navigation to dashboard occurred
    expect(mockNavigate).not.toHaveBeenCalledWith("/student", expect.anything());
    expect(mockNavigate).not.toHaveBeenCalledWith("/general-dashboard", expect.anything());

    // Test Return to Home button
    fireEvent.click(screen.getByRole("button", { name: /Return to Home/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
