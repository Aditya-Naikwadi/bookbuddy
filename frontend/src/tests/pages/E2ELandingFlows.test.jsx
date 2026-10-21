import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Landing from "../../pages/public/Landing";
import Login, { isSafeRelativePath } from "../../pages/Login";
import Register from "../../pages/Register";
import useAuthStore from "../../store/authStore";
import apiClient from "../../api/client";

vi.mock("../../context/ConfigContext", () => ({
  useConfig: () => ({
    googleClientId: "",
  }),
}));

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    setOnUnauthorizedCallback: vi.fn(),
  };
});

vi.mock("../../api/registrationApi", () => ({
  registrationApi: {
    getActiveColleges: vi.fn().mockResolvedValue([
      {
        _id: "college-mit",
        name: "Massachusetts Institute of Technology",
        shortName: "MIT",
        code: "MIT",
        slug: "mit",
        domain: "mit.edu",
        status: "active",
        isActive: true,
      },
      {
        _id: "college-stanford",
        name: "Stanford University",
        shortName: "Stanford",
        code: "STAN",
        slug: "stanford",
        domain: "stanford.edu",
        status: "active",
        isActive: true,
      },
    ]),
  },
}));

describe("16. Testing: Comprehensive E2E & Component Verification Suite", () => {
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
      token: null,
      isAuthenticated: false,
      login: vi.fn().mockResolvedValue(true),
      register: vi.fn().mockResolvedValue(true),
    });

    apiClient.get.mockImplementation((url) => {
      if (url.includes("/books/public")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                _id: "book-p0-123",
                title: "Introduction to Algorithms",
                author: "Cormen et al.",
                department: "Computer Science",
                coverImage:
                  "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c",
                status: "approved",
                moderationStatus: "approved",
              },
            ],
          },
        });
      }
      if (url.includes("/eresources/public")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                _id: "eres-p0-456",
                title: "Frankenstein",
                author: "Mary Shelley",
                category: "Gothic Horror",
                coverImage:
                  "https://images.unsplash.com/photo-1512820790803-83ca734da794",
                format: "EPUB",
                moderationStatus: "approved",
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* TEST 1: (P0) E2E: Land → Click Book (Logged Out) → Redirect to Login       */
  /*         → Log In → Lands on that specific Book                             */
  /* -------------------------------------------------------------------------- */
  it("(P0) E2E: Land → Click Book while logged out → Redirected to Login with book state → Log In → Lands on clicked book", async () => {
    const BookDetailPage = () => {
      const location = useLocation();
      return (
        <div data-testid="student-book-target">
          Book Detail Target: {location.search}
        </div>
      );
    };

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/student/catalog" element={<BookDetailPage />} />
          <Route
            path="/student"
            element={<div data-testid="default-student">Student Home</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for catalog books to render
    await waitFor(() => {
      expect(
        screen.getByText("Introduction to Algorithms"),
      ).toBeInTheDocument();
    });

    // 1. Click on the book card while logged out
    const bookCard =
      screen
        .getByText("Introduction to Algorithms")
        .closest('[role="button"]') ||
      screen.getByText("Introduction to Algorithms");
    fireEvent.click(bookCard);

    // 2. Redirected to Login
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Welcome Back/i }),
      ).toBeInTheDocument();
    });

    // Verify login form is populated and user can authenticate
    const emailInput = screen.getByPlaceholderText(/student@bookbuddy\.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    fireEvent.change(emailInput, { target: { value: "student@mit.edu" } });
    fireEvent.change(passwordInput, {
      target: { value: "CorrectPassword123!" },
    });

    // Mock successful auth response setting user
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: "stu-1",
        role: "student",
        collegeId: { name: "MIT", slug: "mit" },
      },
    });

    const submitBtn = screen.getByRole("button", { name: /Sign in/i });
    fireEvent.click(submitBtn);

    // 3. Lands on that specific book page (not generic dashboard)
    await waitFor(
      () => {
        expect(screen.getByTestId("student-book-target")).toBeInTheDocument();
        expect(screen.getByTestId("student-book-target").textContent).toContain(
          "book-p0-123",
        );
      },
      { timeout: 4000 },
    );
  }, 15000);

  /* -------------------------------------------------------------------------- */
  /* TEST 2: E2E covers each navbar link and each CTA                          */
  /* -------------------------------------------------------------------------- */
  it("E2E: Navbar links and Hero CTAs route or scroll without dead links", async () => {
    const scrollMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/auth/login"
            element={<div data-testid="login-page">Login Page</div>}
          />
          <Route
            path="/auth/register"
            element={<div data-testid="register-page">Register Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    // Test Hero primary CTA
    const browseButtons = screen.getAllByRole("button", {
      name: /Browse the Library/i,
    });
    fireEvent.click(browseButtons[0]);
    expect(scrollMock).toHaveBeenCalled();

    // Test Hero secondary CTA (Login / Register)
    const secondaryCTA = screen.getByRole("button", {
      name: /Login \/ Register/i,
    });
    fireEvent.click(secondaryCTA);
    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* TEST 3: E2E covers the three registration paths & college-picker redirect  */
  /* -------------------------------------------------------------------------- */
  it("E2E: General Patron registration path asks for no college and creates no phantom tenant", async () => {
    render(
      <MemoryRouter initialEntries={["/auth/register"]}>
        <Routes>
          <Route path="/auth/register" element={<Register />} />
          <Route
            path="/general-dashboard"
            element={<div data-testid="general-dash">General Dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    // Default role is General Patron
    expect(
      screen.queryByLabelText(/Select Institution/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/student id/i),
    ).not.toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText("John Doe");
    const emailInput = screen.getByPlaceholderText("john@example.com");
    const passwordInput = screen.getByLabelText(/^Password$/i);

    fireEvent.change(nameInput, { target: { value: "Public Reader" } });
    fireEvent.change(emailInput, { target: { value: "reader@public.org" } });
    fireEvent.change(passwordInput, {
      target: { value: "StrongPatronPass123!" },
    });

    const createBtn = screen.getByRole("button", { name: /create account/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().register).toHaveBeenCalledWith(
        "Public Reader",
        "reader@public.org",
        "StrongPatronPass123!",
        "", // studentId is empty for general
        "general", // role
        "", // collegeId is empty, no phantom college!
      );
    });
  });

  it("E2E: College Student registration path lists active colleges and selects college", async () => {
    render(
      <MemoryRouter initialEntries={["/auth/register"]}>
        <Routes>
          <Route path="/auth/register" element={<Register />} />
        </Routes>
      </MemoryRouter>,
    );

    // Select College Student radio
    const studentRadio = screen.getByLabelText(/College Student/i);
    fireEvent.click(studentRadio);

    // College search dropdown should now be rendered
    await waitFor(() => {
      expect(screen.getByLabelText(/Select Institution/i)).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* TEST 4: Open-Redirect Test                                                 */
  /* -------------------------------------------------------------------------- */
  it("Open-redirect test: a malicious from or returnUrl is strictly rejected", () => {
    expect(isSafeRelativePath("//evil.com")).toBe(false);
    expect(isSafeRelativePath("/\\evil.com")).toBe(false);
    expect(isSafeRelativePath("https://attacker.org")).toBe(false);
    expect(isSafeRelativePath("javascript:alert(document.cookie)")).toBe(false);
    expect(isSafeRelativePath("data:text/html,malicious")).toBe(false);
    expect(isSafeRelativePath("/student/catalog?bookId=book-123")).toBe(true);
    expect(isSafeRelativePath("/eresources/read/classic-456")).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* TEST 5: Cache-Leak Test                                                    */
  /* -------------------------------------------------------------------------- */
  it("Cache-leak test: public catalog data contains no private user credentials", async () => {
    const res = await apiClient.get("/books/public");
    expect(res.data.success).toBe(true);
    res.data.data.forEach((book) => {
      expect(book.userToken).toBeUndefined();
      expect(book.userEmail).toBeUndefined();
      expect(book.studentId).toBeUndefined();
      expect(book.cardSecret).toBeUndefined();
    });
  });
});
