import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GeneralDashboardHome from "../../pages/dashboards/general/GeneralDashboardHome";
import * as bookDataHooks from "../../hooks/useBookData";
import useAuthStore from "../../store/authStore";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../hooks/useBookAvailability", () => ({
  default: vi.fn(),
}));

vi.mock("../../utils/webVitalsTelemetry", () => ({
  initWebVitalsTelemetry: vi.fn(),
}));

const mockPopularBooks = [
  {
    _id: "book-1",
    id: "book-1",
    title: "Introduction to Algorithms",
    author: "Thomas H. Cormen",
    category: "Computer Science",
    availableCopies: 3,
    totalCopies: 5,
    shelfLocation: "Aisle 3, Shelf B",
    coverUrl: "https://example.com/cover1.jpg",
  },
  {
    _id: "book-2",
    id: "book-2",
    title: "Clean Code: A Handbook",
    author: "Robert C. Martin",
    category: "Software Engineering",
    availableCopies: 0,
    totalCopies: 4,
    shelfLocation: "Aisle 1, Shelf D",
    coverUrl: "https://example.com/cover2.jpg",
  },
];

const mockNewArrivals = [
  {
    _id: "book-3",
    id: "book-3",
    title: "Modern Operating Systems",
    author: "Andrew S. Tanenbaum",
    category: "Computer Science",
    availableCopies: 2,
    totalCopies: 2,
  },
];

const mockDashboardPayload = {
  stats: {
    totalCatalogBooks: 1420,
    addedThisMonth: 28,
    categoryBreakdown: [
      { category: "Computer Science", count: 450, percentage: 32 },
      { category: "Mathematics", count: 300, percentage: 21 },
    ],
    sparklineData: [10, 15, 20, 22, 28],
  },
  newArrivals: mockNewArrivals,
  popularBooks: mockPopularBooks,
  announcements: [
    {
      _id: "ann-1",
      title: "Library Orientation Week",
      content: "Welcome all new students to the campus library.",
    },
  ],
  librarySettings: {
    openingHour: "08:00 AM",
    closingHour: "05:00 PM",
    isClosedToday: false,
  },
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("GeneralDashboardHome Component & Navigation Integrity", () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();

    // Default: Authenticated general patron user
    useAuthStore.setState({
      user: {
        _id: "user-gen-1",
        name: "General Patron",
        role: "general",
        collegeId: "col-1",
        collegeName: "Central University",
      },
      isAuthenticated: true,
    });

    vi.spyOn(bookDataHooks, "useGeneralDashboard").mockReturnValue({
      data: mockDashboardPayload,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("1. renders General Patron Dashboard header, operational hours (8:00 AM - 5:00 PM), and catalog stats", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GeneralDashboardHome />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/General Patron Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/08:00 AM - 05:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText("1,420")).toBeInTheDocument();
    expect(screen.getByText(/New Arrivals/i)).toBeInTheDocument();
  });

  it("2. verifies Quick Action buttons correctly navigate to their target routes without dead links", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GeneralDashboardHome />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Click "Search Catalog"
    const searchBtn = screen.getByRole("button", { name: /Search Catalog/i });
    fireEvent.click(searchBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/general-dashboard/search");

    // Click "E-Resources"
    const eresourcesBtn = screen.getByRole("button", { name: /E-Resources/i });
    fireEvent.click(eresourcesBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/general-dashboard/e-resources");

    // Click "My Bookmarks"
    const bookmarksBtn = screen.getByRole("button", { name: /My Bookmarks/i });
    fireEvent.click(bookmarksBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/general-dashboard/saved");

    // General role: Click "Latest Arrivals"
    const latestBtn = screen.getByRole("button", { name: /Latest Arrivals/i });
    fireEvent.click(latestBtn);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/general-dashboard/search?sortBy=newest",
    );
  });

  it("3. verifies Quick Action 4 correctly routes for college-admin and student roles", () => {
    // A. College Admin user
    useAuthStore.setState({
      user: {
        _id: "user-admin-1",
        name: "Admin",
        role: "college-admin",
        collegeId: "col-1",
      },
    });

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GeneralDashboardHome />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const uploadBtn = screen.getByRole("button", { name: /Upload Students/i });
    fireEvent.click(uploadBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/college-admin/bulk-upload");

    // B. Student user
    useAuthStore.setState({
      user: {
        _id: "user-stu-1",
        name: "Student",
        role: "student",
        collegeId: "col-1",
      },
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GeneralDashboardHome />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const labBtn = screen.getByRole("button", { name: /Lab Booking/i });
    fireEvent.click(labBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/lab-booking");
  });

  it("4. verifies 'View all' New Arrivals routes to /general-dashboard/search?sortBy=newest", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GeneralDashboardHome />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const viewAllBtn = screen.getByRole("button", { name: /View all/i });
    fireEvent.click(viewAllBtn);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/general-dashboard/search?sortBy=newest",
    );
  });

  it("5. verifies search autocomplete filter, suggestion selection, and Enter key navigation", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GeneralDashboardHome />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const searchInput = screen.getByPlaceholderText(
      /Search catalog by title, author, or ISBN.../i,
    );

    // Enter query "Algorithms"
    fireEvent.change(searchInput, { target: { value: "Algorithms" } });

    // Autocomplete option should appear in suggestions dropdown
    const matchingElements = screen.getAllByText("Introduction to Algorithms");
    expect(matchingElements.length).toBeGreaterThan(0);

    // Press Enter to navigate
    fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });
    expect(mockNavigate).toHaveBeenCalledWith(
      "/general-dashboard/search?q=Algorithms",
    );
  });

  it("6. opens Book Details Modal, verifies dialog a11y, and tests Escape key closing", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GeneralDashboardHome />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Click "Details" on the popular book card
    const detailsButtons = screen.getAllByRole("button", { name: /Details/i });
    fireEvent.click(detailsButtons[0]);

    // Modal should be visible with role="dialog" and aria-modal="true"
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const modalTitle = within(dialog).getByRole("heading", {
      name: "Introduction to Algorithms",
      level: 3,
    });
    expect(modalTitle).toBeInTheDocument();
    expect(within(dialog).getByText(/Aisle 3, Shelf B/i)).toBeInTheDocument();

    // Click "Search in Catalog" inside modal
    const searchInCatalogBtn = screen.getByRole("button", {
      name: /Search in Catalog/i,
    });
    fireEvent.click(searchInCatalogBtn);
    expect(mockNavigate).toHaveBeenCalledWith(
      `/general-dashboard/search?q=${encodeURIComponent("Introduction to Algorithms")}`,
    );

    // Reopen modal and test Escape key to dismiss
    fireEvent.click(detailsButtons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("7. opens Book Details Modal when clicking a New Arrival item", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GeneralDashboardHome />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const arrivalBtn = screen.getByRole("button", {
      name: /Modern Operating Systems/i,
    });
    fireEvent.click(arrivalBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Modern Operating Systems/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/2 of 2 in library/i)).toBeInTheDocument();
  });
});
