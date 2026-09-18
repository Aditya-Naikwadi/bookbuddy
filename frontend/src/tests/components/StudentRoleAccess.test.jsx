import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardLayout from "../../layouts/DashboardLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import useAuthStore from "../../store/authStore";
import { FeatureFlagContext } from "../../context/featureFlagContextObject";
import { isUserAllowedForRoute } from "../../config/roleRouteConfig";

vi.mock("../../components/student/NotificationCenter", () => ({
  default: () => <div data-testid="notification-center">Notifications</div>,
}));

vi.mock("../../components/common/ThemeToggle", () => ({
  default: () => <div data-testid="theme-toggle">Theme</div>,
}));

vi.mock("../../components/student/auth/ForcedPasswordChangeModal", () => ({
  ForcedPasswordChangeModal: () => null,
}));

describe("Student & College-Student Route Access and Navigation Suite", () => {
  let queryClient;

  const mockFeatureContext = {
    enabledFeatures: ["catalog", "loans", "fines", "e-resources", "facilities"],
    limits: {},
    isLoading: false,
    isError: false,
    isFeatureEnabled: () => true,
    refetchFeatures: vi.fn(),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("1. isUserAllowedForRoute permits both 'student' and 'college-student' on student routes", () => {
    const studentUser = { _id: "stu-1", role: "student" };
    const collegeStudentUser = { _id: "stu-2", role: "college-student" };
    const generalUser = { _id: "gen-1", role: "general" };

    const studentPaths = [
      "/student",
      "/student/catalog",
      "/student/loans",
      "/student/fines",
      "/student/card",
      "/student/e-resources",
      "/student/shelves",
      "/student/facilities",
    ];

    studentPaths.forEach((path) => {
      expect(isUserAllowedForRoute(studentUser, path)).toBe(true);
      expect(isUserAllowedForRoute(collegeStudentUser, path)).toBe(true);
      expect(isUserAllowedForRoute(generalUser, path)).toBe(false);
    });
  });

  it("2. DashboardLayout renders Student Navigation for user with role 'college-student'", () => {
    useAuthStore.setState({
      user: {
        _id: "stu-2",
        name: "Test College Student",
        email: "student@university.edu",
        role: "college-student",
        collegeId: "college-123",
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <FeatureFlagContext.Provider value={mockFeatureContext}>
          <MemoryRouter initialEntries={["/student"]}>
            <DashboardLayout />
          </MemoryRouter>
        </FeatureFlagContext.Provider>
      </QueryClientProvider>,
    );

    // Desktop nav should show Student Dashboard and Student Features
    expect(screen.getByText("Student Dashboard")).toBeInTheDocument();
    const studentFeaturesHeaders = screen.getAllByText("Student Features");
    expect(studentFeaturesHeaders.length).toBeGreaterThanOrEqual(1);

    // Verify student feature items render
    expect(screen.getAllByText("Catalog & Search")[0]).toBeInTheDocument();
    expect(screen.getAllByText("My Borrowing")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Fines & Dues")[0]).toBeInTheDocument();
  });

  it("3. ProtectedRoute allows 'college-student' account into student routes without redirect to /unauthorized", () => {
    useAuthStore.setState({
      user: {
        _id: "stu-2",
        name: "College Student",
        email: "collegestudent@campus.edu",
        role: "college-student",
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/student/loans"]}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={["student", "college-student"]} />}>
            <Route path="/student/loans" element={<div data-testid="student-loans-page">Loans Page Content</div>} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">403 Unauthorized</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Should display the protected page, not redirect to /unauthorized
    expect(screen.getByTestId("student-loans-page")).toBeInTheDocument();
    expect(screen.queryByTestId("unauthorized-page")).not.toBeInTheDocument();
  });

  it("4. ProtectedRoute backwards compatibility: allows 'college-student' even when allowedRoles only specifies ['student']", () => {
    useAuthStore.setState({
      user: {
        _id: "stu-2",
        name: "Legacy College Student",
        email: "legacy@campus.edu",
        role: "college-student",
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/student/catalog"]}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
            <Route path="/student/catalog" element={<div data-testid="student-catalog-page">Catalog Page Content</div>} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">403 Unauthorized</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Should display the catalog page without redirecting
    expect(screen.getByTestId("student-catalog-page")).toBeInTheDocument();
    expect(screen.queryByTestId("unauthorized-page")).not.toBeInTheDocument();
  });

  it("5. ProtectedRoute correctly redirects non-student roles to /unauthorized", () => {
    useAuthStore.setState({
      user: {
        _id: "general-user",
        name: "General Patron",
        email: "patron@gmail.com",
        role: "general",
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/student/fines"]}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={["student", "college-student"]} />}>
            <Route path="/student/fines" element={<div data-testid="student-fines-page">Fines Page Content</div>} />
          </Route>
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">403 Unauthorized</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Non-student should be redirected to /unauthorized
    expect(screen.queryByTestId("student-fines-page")).not.toBeInTheDocument();
    expect(screen.getByTestId("unauthorized-page")).toBeInTheDocument();
  });
});
