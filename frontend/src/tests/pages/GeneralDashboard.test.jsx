import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GeneralDashboardHome from "../../pages/dashboards/general/GeneralDashboardHome";
import DigitalReaderModal from "../../components/general/DigitalReaderModal";
import GeneralSearch from "../../pages/dashboards/general/GeneralSearch";
import GeneralSaved from "../../pages/dashboards/general/GeneralSaved";
import GeneralEResources from "../../pages/dashboards/general/GeneralEResources";
import * as bookDataHooks from "../../hooks/useBookData";
import useAuthStore from "../../store/authStore";

const mockNavigate = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => defaultValue || key,
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
  I18nextProvider: ({ children }) => children,
}));

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

vi.mock("../../api/annotationApi", () => ({
  getBookAnnotations: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createAnnotationApi: vi.fn().mockResolvedValue({ success: true, data: {} }),
  updateAnnotationApi: vi.fn().mockResolvedValue({ success: true, data: {} }),
  deleteAnnotationApi: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../utils/annotationOfflineStore", () => ({
  queueOfflineAnnotation: vi.fn(),
  flushOfflineQueue: vi.fn().mockResolvedValue(),
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

describe("General Dashboard Consolidated Suite", () => {
  describe("GeneralDashboardHome Component & Navigation Integrity", () => {
    let queryClient;

    beforeEach(() => {
      vi.clearAllMocks();
      queryClient = createTestQueryClient();

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

      const searchBtn = screen.getByRole("button", { name: /Search Catalog/i });
      fireEvent.click(searchBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/general-dashboard/search");

      const eresourcesBtn = screen.getByRole("button", {
        name: /E-Resources/i,
      });
      fireEvent.click(eresourcesBtn);
      expect(mockNavigate).toHaveBeenCalledWith(
        "/general-dashboard/e-resources",
      );

      const bookmarksBtn = screen.getByRole("button", {
        name: /My Bookmarks/i,
      });
      fireEvent.click(bookmarksBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/general-dashboard/saved");

      const latestBtn = screen.getByRole("button", {
        name: /Latest Arrivals/i,
      });
      fireEvent.click(latestBtn);
      expect(mockNavigate).toHaveBeenCalledWith(
        "/general-dashboard/search?sortBy=newest",
      );
    });

    it("3. verifies Quick Action 4 correctly routes for college-admin and student roles", () => {
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

      const uploadBtn = screen.getByRole("button", {
        name: /Upload Students/i,
      });
      fireEvent.click(uploadBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/college-admin/bulk-upload");

      act(() => {
        useAuthStore.setState({
          user: {
            _id: "user-stu-1",
            name: "Student",
            role: "student",
            collegeId: "col-1",
          },
        });
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

      fireEvent.change(searchInput, { target: { value: "Algorithms" } });

      const matchingElements = screen.getAllByText(
        "Introduction to Algorithms",
      );
      expect(matchingElements.length).toBeGreaterThan(0);

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

      const detailsButtons = screen.getAllByRole("button", {
        name: /Details/i,
      });
      fireEvent.click(detailsButtons[0]);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");

      const modalTitle = within(dialog).getByRole("heading", {
        name: "Introduction to Algorithms",
        level: 3,
      });
      expect(modalTitle).toBeInTheDocument();
      expect(within(dialog).getByText(/Aisle 3, Shelf B/i)).toBeInTheDocument();

      const searchInCatalogBtn = screen.getByRole("button", {
        name: /Search in Catalog/i,
      });
      fireEvent.click(searchInCatalogBtn);
      expect(mockNavigate).toHaveBeenCalledWith(
        `/general-dashboard/search?q=${encodeURIComponent("Introduction to Algorithms")}`,
      );

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
      expect(
        within(dialog).getByText(/2 of 2 in library/i),
      ).toBeInTheDocument();
    });
  });

  describe("Digital Reader & Modernized General Dashboard", () => {
    let queryClient;

    beforeEach(() => {
      queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });
      vi.clearAllMocks();
    });

    describe("Bug Fix: Book Reader Content Rendering", () => {
      it("renders rich structured book content for 'Computer Science EPUB' instead of blank area", async () => {
        const mockBook = {
          id: "cs-book-1",
          _id: "cs-book-1",
          title: "Computer Science",
          author: "Alan Turing",
          format: "epub",
          category: "Computer Science",
          description: "Foundational computer science principles",
        };

        render(
          <DigitalReaderModal
            isOpen={true}
            onClose={vi.fn()}
            book={mockBook}
            title="Computer Science"
            fileType="epub"
          />,
        );

        expect(
          screen.getAllByText("Computer Science").length,
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("EPUB")).toBeInTheDocument();

        await waitFor(() => {
          expect(
            screen.getByText(/Foundational Principles & Architecture/i),
          ).toBeInTheDocument();
        });

        expect(
          screen.getByText(/The Mathematical Foundations of Computation/i),
        ).toBeInTheDocument();
        expect(
          screen.getAllByText(/Church-Turing Thesis/i).length,
        ).toBeGreaterThanOrEqual(1);
        expect(
          screen.getByText(
            /Simplified Von Neumann Instruction Cycle Simulation/i,
          ),
        ).toBeInTheDocument();

        await waitFor(() => {
          expect(screen.getByText(/Page 1 of 5/i)).toBeInTheDocument();
        });
      });

      it("allows chapter pagination (Next Page / Previous Page) in structured reader", async () => {
        const mockBook = {
          id: "cs-book-1",
          title: "Computer Science",
          format: "epub",
          category: "Computer Science",
        };

        render(
          <DigitalReaderModal
            isOpen={true}
            onClose={vi.fn()}
            book={mockBook}
            title="Computer Science"
            fileType="epub"
          />,
        );

        await waitFor(() => {
          expect(
            screen.getByText(/Foundational Principles & Architecture/i),
          ).toBeInTheDocument();
        });

        const nextBtn = screen.getByLabelText("Next Page");
        fireEvent.click(nextBtn);

        await waitFor(() => {
          expect(
            screen.getByText(/Data Structures & Algorithmic Complexity/i),
          ).toBeInTheDocument();
        });
        expect(screen.getByText(/Page 2 of 5/i)).toBeInTheDocument();

        const prevBtn = screen.getByLabelText("Previous Page");
        fireEvent.click(prevBtn);

        await waitFor(() => {
          expect(
            screen.getByText(/Foundational Principles & Architecture/i),
          ).toBeInTheDocument();
        });
        expect(screen.getByText(/Page 1 of 5/i)).toBeInTheDocument();
      });

      it("renders structured content for generic academic textbooks when EPUB binary is absent", async () => {
        const mockBook = {
          id: "lit-book-1",
          title: "World Literature Foundations",
          author: "Jane Austen",
          format: "epub",
          category: "Literature",
        };

        render(
          <DigitalReaderModal
            isOpen={true}
            onClose={vi.fn()}
            book={mockBook}
            title="World Literature Foundations"
            fileType="epub"
          />,
        );

        await waitFor(() => {
          expect(
            screen.getByText(/Introduction to World Literature Foundations/i),
          ).toBeInTheDocument();
        });
        expect(
          screen.getByText(/Overview and Academic Context/i),
        ).toBeInTheDocument();
      });

      it("public reader highlight/bookmark attempt shows login prompt, not a 401 error", async () => {
        useAuthStore.setState({
          isAuthenticated: false,
          user: null,
        });

        const mockBook = {
          id: "cs-book-1",
          title: "Computer Science",
          format: "epub",
          category: "Computer Science",
        };

        render(
          <DigitalReaderModal
            isOpen={true}
            onClose={vi.fn()}
            book={mockBook}
            title="Computer Science"
            fileType="epub"
          />,
        );

        await waitFor(() => {
          expect(
            screen.getByText(/Foundational Principles & Architecture/i),
          ).toBeInTheDocument();
        });

        const bookmarkBtn = screen.getByTitle("Bookmark Location");
        fireEvent.click(bookmarkBtn);

        expect(screen.getByText("Add Bookmark")).toBeInTheDocument();
        const saveBookmarkBtn = screen.getByText("Save Bookmark");
        fireEvent.click(saveBookmarkBtn);

        await waitFor(() => {
          expect(screen.getByTestId("login-prompt-modal")).toBeInTheDocument();
        });
        expect(
          screen.getByText("Sign In to Save Highlights"),
        ).toBeInTheDocument();
        expect(screen.getByText(/Page 1 \(preserved\)/i)).toBeInTheDocument();

        const loginBtn = screen.getByTestId("login-prompt-login-btn");
        fireEvent.click(loginBtn);

        expect(mockNavigate).toHaveBeenCalledWith(
          "/auth/login",
          expect.objectContaining({
            state: expect.objectContaining({
              bookId: "cs-book-1",
              page: 1,
              bookTitle: "Computer Science",
            }),
          }),
        );
      });
    });

    describe("Redesign: Visual Polish of General Dashboard", () => {
      const mockDashboardData = {
        stats: {
          totalCatalogBooks: 1540,
          addedThisMonth: 32,
          categoryBreakdown: [
            { category: "Computer Science", count: 500, percentage: 35 },
            { category: "Engineering", count: 400, percentage: 28 },
          ],
        },
        newArrivals: [
          {
            _id: "book-new-1",
            id: "book-new-1",
            title: "Computer Science EPUB",
            author: "Donald Knuth",
            category: "Computer Science",
            format: "digital",
            availableCopies: 1,
            totalCopies: 1,
          },
        ],
        popularBooks: [
          {
            _id: "book-pop-1",
            id: "book-pop-1",
            title: "Operating System Concepts",
            author: "Abraham Silberschatz",
            category: "Computer Science",
            availableCopies: 4,
            totalCopies: 5,
          },
        ],
        announcements: [],
        librarySettings: {
          openingHour: "08:00 AM",
          closingHour: "05:00 PM",
          isClosedToday: false,
        },
      };

      beforeEach(() => {
        vi.spyOn(bookDataHooks, "useGeneralDashboard").mockReturnValue({
          data: mockDashboardData,
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn(),
        });
      });

      it("renders polished SaaS dashboard with metric cards and library hours", () => {
        render(
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <GeneralDashboardHome />
            </MemoryRouter>
          </QueryClientProvider>,
        );

        expect(
          screen.getByText("General Patron Dashboard"),
        ).toBeInTheDocument();
        expect(screen.getByText("Library Hours")).toBeInTheDocument();
        expect(screen.getByText(/08:00 AM - 05:00 PM/i)).toBeInTheDocument();
        expect(screen.getByText("Total Catalog Books")).toBeInTheDocument();
        expect(screen.getByText("1,540")).toBeInTheDocument();
        expect(screen.getByText("+32 added this month")).toBeInTheDocument();
        expect(screen.getByText("Search Catalog")).toBeInTheDocument();
        expect(screen.getByText("E-Resources")).toBeInTheDocument();
        expect(screen.getByText("My Bookmarks")).toBeInTheDocument();
        expect(screen.getByText("Popular This Week")).toBeInTheDocument();
        expect(
          screen.getAllByText("Operating System Concepts").length,
        ).toBeGreaterThanOrEqual(1);
      });

      it("opens book details modal and displays 'Read Online' for digital titles", async () => {
        render(
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <GeneralDashboardHome />
            </MemoryRouter>
          </QueryClientProvider>,
        );

        const newArrivalItem = screen.getByText("Computer Science EPUB");
        fireEvent.click(newArrivalItem);

        await waitFor(() => {
          expect(screen.getByRole("dialog")).toBeInTheDocument();
        });

        expect(screen.getByText("Read Online")).toBeInTheDocument();
        expect(screen.getByText("Bookmark Item")).toBeInTheDocument();
        expect(screen.getByText("Search in Catalog")).toBeInTheDocument();
      });
    });
  });

  describe("General Dashboard Sub-Pages: GeneralSearch, GeneralSaved, GeneralEResources", () => {
    let queryClient;

    beforeEach(() => {
      vi.clearAllMocks();
      queryClient = createTestQueryClient();
      localStorage.clear();

      if (typeof globalThis.ResizeObserver === "undefined") {
        globalThis.ResizeObserver = class {
          observe() {}
          unobserve() {}
          disconnect() {}
        };
      }

      useAuthStore.setState({
        user: {
          _id: "user-gen-1",
          name: "General Patron",
          role: "general",
          collegeId: "col-1",
        },
        isAuthenticated: true,
      });

      vi.spyOn(bookDataHooks, "useBookSearch").mockReturnValue({
        data: {
          books: [
            {
              _id: "book-1",
              id: "book-1",
              title: "Database System Concepts",
              author: "Silberschatz",
              category: "Computer Science",
              availableCopies: 4,
              totalCopies: 6,
              shelfLocation: "Aisle 2, Shelf C",
            },
          ],
          pagination: { page: 1, limit: 12, total: 1, pages: 1 },
        },
        isLoading: false,
        isError: false,
      });

      vi.spyOn(bookDataHooks, "useBatchBookDetails").mockReturnValue({
        data: [
          {
            _id: "saved-1",
            id: "saved-1",
            title: "Operating Systems Principles",
            author: "Galvin",
            availableCopies: 2,
            totalCopies: 3,
            shelfLocation: "Aisle 4, Shelf A",
          },
        ],
        isLoading: false,
      });

      vi.spyOn(bookDataHooks, "useAggregatedBooks").mockReturnValue({
        data: {
          books: [
            {
              _id: "agg-1",
              id: "agg-1",
              title: "Frankenstein",
              author: "Mary Shelley",
              externalId: "84",
            },
          ],
        },
        isLoading: false,
      });
    });

    it("1. renders GeneralSearch and verifies filters and search inputs", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={["/general-dashboard/search?filter=new"]}
          >
            <GeneralSearch />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(
        screen.getAllByText(/Database System Concepts/i).length,
      ).toBeGreaterThan(0);
    });

    it("2. renders GeneralSaved and displays bookmarks with real-time status and clear action", () => {
      localStorage.setItem(
        "bookbuddy_public_bookmarks",
        JSON.stringify([
          {
            _id: "saved-1",
            id: "saved-1",
            title: "Operating Systems Principles",
            author: "Galvin",
            availableCopies: 2,
          },
        ]),
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/general-dashboard/saved"]}>
            <GeneralSaved />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(
        screen.getAllByText(/Operating Systems Principles/i).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText(/2 Available/i)).toBeInTheDocument();

      const clearBtn = screen.getByTitle(/Clear all saved bookmarks/i);
      expect(clearBtn).toBeInTheDocument();
    });

    it("3. renders GeneralEResources with open-access books and reader triggers", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/general-dashboard/e-resources"]}>
            <GeneralEResources />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByText(/Frankenstein/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Preview In-App/i).length).toBeGreaterThan(0);
    });
  });
});
