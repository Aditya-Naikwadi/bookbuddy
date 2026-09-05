import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DigitalReaderModal from "../../components/general/DigitalReaderModal";
import GeneralDashboardHome from "../../pages/dashboards/general/GeneralDashboardHome";
import * as bookDataHooks from "../../hooks/useBookData";
import useAuthStore from "../../store/authStore";

// Mock router navigation
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

      // Verify header rendered title and EPUB format badge
      expect(screen.getByText("Computer Science")).toBeInTheDocument();
      expect(screen.getByText("EPUB")).toBeInTheDocument();

      // Verify the structured reader renders content, not an empty container
      await waitFor(() => {
        expect(
          screen.getByText(/Foundational Principles & Architecture/i),
        ).toBeInTheDocument();
      });

      // Verify chapter content elements
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

      // Verify pagination indicator in reader header
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

      // Click Next Page button
      const nextBtn = screen.getByLabelText("Next Page");
      fireEvent.click(nextBtn);

      // Verify Chapter 2 content loads
      await waitFor(() => {
        expect(
          screen.getByText(/Data Structures & Algorithmic Complexity/i),
        ).toBeInTheDocument();
      });
      expect(screen.getByText(/Page 2 of 5/i)).toBeInTheDocument();

      // Click Previous Page button
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

      // Verify header
      expect(screen.getByText("General Patron Dashboard")).toBeInTheDocument();

      // Verify library hours widget
      expect(screen.getByText("Library Hours")).toBeInTheDocument();
      expect(screen.getByText(/08:00 AM - 05:00 PM/i)).toBeInTheDocument();

      // Verify metrics card
      expect(screen.getByText("Total Catalog Books")).toBeInTheDocument();
      expect(screen.getByText("1,540")).toBeInTheDocument();
      expect(screen.getByText("+32 added this month")).toBeInTheDocument();

      // Verify quick action shortcuts
      expect(screen.getByText("Search Catalog")).toBeInTheDocument();
      expect(screen.getByText("E-Resources")).toBeInTheDocument();
      expect(screen.getByText("My Bookmarks")).toBeInTheDocument();

      // Verify popular books carousel
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

      // Click on the new arrival item "Computer Science EPUB"
      const newArrivalItem = screen.getByText("Computer Science EPUB");
      fireEvent.click(newArrivalItem);

      // Modal opens
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Verify "Read Online" button is present for this digital book
      expect(screen.getByText("Read Online")).toBeInTheDocument();
      expect(screen.getByText("Bookmark Item")).toBeInTheDocument();
      expect(screen.getByText("Search in Catalog")).toBeInTheDocument();
    });
  });
});
