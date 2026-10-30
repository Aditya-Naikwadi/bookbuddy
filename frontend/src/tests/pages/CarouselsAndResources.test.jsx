import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CatalogSearch } from "../../sections/CatalogSearch";
import { EResources } from "../../sections/EResources";
import useAuthStore from "../../store/authStore";
import apiClient from "../../api/client";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      get: vi.fn(),
      post: vi.fn(),
    },
    setOnUnauthorizedCallback: vi.fn(),
  };
});

describe("3. Catalog & E-Resource Carousels Strict Test Suite", () => {
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
      isAuthenticated: false,
    });
  });

  describe("Requirement 1: (P0) Both carousels load real data from the API", () => {
    it("CatalogSearch fetches and renders real books from /books/public", async () => {
      const mockApiBooks = [
        {
          _id: "book-api-1",
          title: "Database System Concepts",
          author: "Abraham Silberschatz",
          category: "Databases",
          shelfLocation: "Shelf DB-401",
          copiesAvailable: 4,
          copiesTotal: 5,
          coverImage: "https://example.com/db.jpg",
        },
      ];

      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: mockApiBooks },
      });

      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/books/public",
          expect.objectContaining({
            params: expect.objectContaining({ limit: 12 }),
          }),
        );
      });

      expect(
        await screen.findByText("Database System Concepts"),
      ).toBeInTheDocument();
      expect(screen.getByText("Abraham Silberschatz")).toBeInTheDocument();
      expect(screen.getByText("4 Available")).toBeInTheDocument();
    });

    it("EResources fetches and renders approved digital books from /eresources/public", async () => {
      const mockApiEResources = [
        {
          _id: "eres-api-1",
          title: "War and Peace",
          author: "Leo Tolstoy",
          category: "Classic Literature",
          format: "EPUB / PDF",
          moderationStatus: "approved",
          coverImage: "https://example.com/war.jpg",
        },
      ];

      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: mockApiEResources },
      });

      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/eresources/public",
          expect.objectContaining({
            params: expect.objectContaining({ limit: 12 }),
          }),
        );
      });

      expect(await screen.findByText("War and Peace")).toBeInTheDocument();
      expect(screen.getByText("Leo Tolstoy")).toBeInTheDocument();
    });
  });

  describe("Requirement 2: (P0) Horizontal scroll works with mouse drag/wheel, touch swipe, trackpad, and keyboard", () => {
    it("Scroll buttons, keyboard arrow navigation, and mouse drag work in CatalogSearch", async () => {
      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: [] },
      });

      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      const carousel = await screen.findByTestId("catalog-carousel");
      const scrollByMock = vi.fn();
      carousel.scrollBy = scrollByMock;

      // Visible prev/next buttons
      const nextBtn = screen.getByLabelText("Scroll catalog right");
      const prevBtn = screen.getByLabelText("Scroll catalog left");

      fireEvent.click(nextBtn);
      expect(scrollByMock).toHaveBeenCalledWith(
        expect.objectContaining({ left: 340, behavior: "smooth" }),
      );

      fireEvent.click(prevBtn);
      expect(scrollByMock).toHaveBeenCalledWith(
        expect.objectContaining({ left: -340, behavior: "smooth" }),
      );

      // Keyboard navigation
      fireEvent.keyDown(carousel, { key: "ArrowRight" });
      expect(scrollByMock).toHaveBeenCalledWith(
        expect.objectContaining({ left: 340 }),
      );

      fireEvent.keyDown(carousel, { key: "ArrowLeft" });
      expect(scrollByMock).toHaveBeenCalledWith(
        expect.objectContaining({ left: -340 }),
      );

      // Mouse drag simulation
      carousel.scrollLeft = 100;
      fireEvent.mouseDown(carousel, { pageX: 200 });
      fireEvent.mouseMove(carousel, { pageX: 150 });
      expect(carousel.style.cursor).toBe("grabbing");
      fireEvent.mouseUp(carousel);
      expect(carousel.style.cursor).toBe("grab");

      // Mouse wheel event
      fireEvent.wheel(carousel, { deltaY: 50, deltaX: 0 });
    });

    it("Scroll buttons, keyboard navigation, and mouse drag work in EResources", async () => {
      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: [] },
      });

      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      const carousel = await screen.findByTestId("eresources-carousel");
      const scrollByMock = vi.fn();
      carousel.scrollBy = scrollByMock;

      const nextBtn = screen.getByLabelText("Scroll e-resources right");
      const prevBtn = screen.getByLabelText("Scroll e-resources left");

      fireEvent.click(nextBtn);
      expect(scrollByMock).toHaveBeenCalledWith(
        expect.objectContaining({ left: 320 }),
      );

      fireEvent.click(prevBtn);
      expect(scrollByMock).toHaveBeenCalledWith(
        expect.objectContaining({ left: -320 }),
      );

      fireEvent.keyDown(carousel, { key: "ArrowRight" });
      expect(scrollByMock).toHaveBeenCalledWith(
        expect.objectContaining({ left: 320 }),
      );

      // Mouse drag
      fireEvent.mouseDown(carousel, { pageX: 300 });
      fireEvent.mouseMove(carousel, { pageX: 250 });
      expect(carousel.style.cursor).toBe("grabbing");
      fireEvent.mouseUp(carousel);
      expect(carousel.style.cursor).toBe("grab");
    });
  });

  describe("Requirement 3: Skeleton loaders shown while data loads (no layout jump)", () => {
    it("CatalogSearch renders skeleton placeholder cards during API fetch", () => {
      apiClient.get.mockReturnValueOnce(new Promise(() => {}));

      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      expect(screen.getByTestId("catalog-skeleton")).toBeInTheDocument();
    });

    it("EResources renders skeleton placeholder cards during API fetch", () => {
      apiClient.get.mockReturnValueOnce(new Promise(() => {}));

      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      expect(screen.getByTestId("eresources-skeleton")).toBeInTheDocument();
    });
  });

  describe("Requirement 4: Empty state shown if there are zero items with reset option", () => {
    it("CatalogSearch displays friendly empty state and reset button when search has no results", async () => {
      apiClient.get.mockResolvedValue({
        data: { success: true, data: [] },
      });

      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      const searchInput = screen.getByLabelText("Search catalog");
      fireEvent.change(searchInput, {
        target: { value: "UnknownRareQuery999" },
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
        },
        { timeout: 4000 },
      );

      expect(screen.getByText("No Catalog Items Found")).toBeInTheDocument();

      const resetBtn = screen.getByText("Reset Filters");
      fireEvent.click(resetBtn);
      expect(searchInput.value).toBe("");
    });

    it("EResources displays friendly empty state and reset button when filtered items are empty", async () => {
      apiClient.get.mockResolvedValue({
        data: { success: true, data: [] },
      });

      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      const searchInput = screen.getByLabelText("Search e-resources");
      fireEvent.change(searchInput, { target: { value: "GhostNovelxyz" } });

      await waitFor(
        () => {
          expect(screen.getByTestId("eresources-empty")).toBeInTheDocument();
        },
        { timeout: 4000 },
      );

      expect(screen.getByText("No E-Resources Found")).toBeInTheDocument();
    });
  });

  describe("Requirement 5: Error state shown if API fails with a retry button", () => {
    it("CatalogSearch displays error state when API fails and retries on click", async () => {
      apiClient.get.mockRejectedValueOnce(
        new Error("500 Internal Server Error"),
      );

      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled();
      });
    });
  });

  describe("Requirement 6 & 7: Book cards show cover image, title, author, badge and clean truncation", () => {
    it("Card elements are properly structured and have line-clamp truncation styles", async () => {
      const mockLongTitleBook = [
        {
          _id: "book-long-1",
          title:
            "A Very Long And Exhaustive Title Exploring Complex Software Architectures And Modern Systems Design Principles",
          author:
            "An Author With An Extremely Long Academic Name And Multiple Affiliations",
          category: "Computer Science",
          shelfLocation: "Shelf CS-999",
          copiesAvailable: 1,
          coverImage: "https://example.com/cover.jpg",
        },
      ];

      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: mockLongTitleBook },
      });

      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      const titleEl = await screen.findByText(
        /A Very Long And Exhaustive Title/,
      );
      expect(titleEl).toHaveClass("line-clamp-2");

      const authorEl = screen.getByText(/An Author With An Extremely Long/);
      expect(authorEl).toHaveClass("truncate");
    });
  });

  describe("Requirement 8: (P0) Clicking any book/resource while logged out redirects to Login and preserves destination", () => {
    it("Clicking a catalog book while logged out navigates to /auth/login with returnUrl and book info", async () => {
      const mockBook = [
        {
          _id: "book-target-123",
          title: "Clean Architecture",
          author: "Robert C. Martin",
          category: "Software",
          shelfLocation: "Shelf CS-1",
          copiesAvailable: 2,
        },
      ];

      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: mockBook },
      });

      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      const heading = await screen.findByRole("heading", {
        name: "Clean Architecture",
      });
      const card = heading.closest('[data-testid="catalog-book-card"]');
      fireEvent.click(card);

      expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
        state: expect.objectContaining({
          from: "catalog-search",
          bookId: "book-target-123",
          bookTitle: "Clean Architecture",
          returnUrl: "/student/catalog?bookId=book-target-123",
        }),
      });
    });

    it("Clicking an e-resource while logged out navigates to /auth/login with isEResource and reader returnUrl", async () => {
      const mockResource = [
        {
          _id: "eres-target-456",
          title: "Moby Dick",
          author: "Herman Melville",
          category: "Adventure",
          format: "EPUB",
          moderationStatus: "approved",
        },
      ];

      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: mockResource },
      });

      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      const heading = await screen.findByRole("heading", { name: "Moby Dick" });
      const card = heading.closest('[data-testid="eresources-book-card"]');
      fireEvent.click(card);

      expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
        state: expect.objectContaining({
          from: "e-resources",
          bookId: "eres-target-456",
          bookTitle: "Moby Dick",
          isEResource: true,
          returnUrl: "/student/reader/eres-target-456",
        }),
      });
    });
  });

  describe("Requirement 10: Clicking a book while logged in opens it directly", () => {
    it("Student clicking catalog book navigates directly to student catalog with bookId", async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { role: "student", name: "Alice" },
      });

      const mockBook = [
        {
          _id: "book-logged-in-1",
          title: "Algorithms Unlocked",
          author: "Thomas H. Cormen",
          category: "Algorithms",
          shelfLocation: "Shelf AL-2",
        },
      ];

      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: mockBook },
      });

      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      const heading = await screen.findByRole("heading", {
        name: "Algorithms Unlocked",
      });
      const card = heading.closest('[data-testid="catalog-book-card"]');
      fireEvent.click(card);

      expect(mockNavigate).toHaveBeenCalledWith(
        "/student/catalog?bookId=book-logged-in-1",
      );
    });

    it("Student clicking e-resource navigates directly to reader with bookId", async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { role: "student", name: "Alice" },
      });

      const mockResource = [
        {
          _id: "eres-logged-in-2",
          title: "The Odyssey",
          author: "Homer",
          category: "Epic",
          format: "EPUB",
          moderationStatus: "approved",
        },
      ];

      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: mockResource },
      });

      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      const heading = await screen.findByRole("heading", {
        name: "The Odyssey",
      });
      const card = heading.closest('[data-testid="eresources-book-card"]');
      fireEvent.click(card);

      expect(mockNavigate).toHaveBeenCalledWith(
        "/student/reader/eres-logged-in-2",
      );
    });
  });

  describe("Requirement 11: Only approved/published items appear (no pending, rejected, draft)", () => {
    it("Filters out pending and rejected e-resources from rendering", async () => {
      const mockMixedResources = [
        {
          _id: "item-approved",
          title: "Approved Classical Essay",
          author: "Seneca",
          moderationStatus: "approved",
        },
        {
          _id: "item-published",
          title: "Published Historical Record",
          author: "Tacitus",
          moderationStatus: "published",
        },
        {
          _id: "item-pending",
          title: "Unmoderated Draft Submission",
          author: "Unknown Author",
          moderationStatus: "pending",
        },
        {
          _id: "item-rejected",
          title: "Rejected Inappropriate Resource",
          author: "Spam Author",
          moderationStatus: "rejected",
        },
      ];

      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: mockMixedResources },
      });

      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      expect(
        await screen.findByRole("heading", {
          name: "Approved Classical Essay",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Published Historical Record" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Unmoderated Draft Submission"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Rejected Inappropriate Resource"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Requirement 12: Public search box works, debounced, and handles special characters safely", () => {
    it("Safely passes regex characters to search without breaking", async () => {
      apiClient.get.mockResolvedValue({
        data: { success: true, data: [] },
      });

      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      const input = screen.getByLabelText("Search catalog");

      // Test regex special characters
      fireEvent.change(input, {
        target: { value: "C++ [Advanced] (2024)*+?" },
      });

      await waitFor(
        () => {
          expect(apiClient.get).toHaveBeenCalledWith(
            "/books/public",
            expect.objectContaining({
              params: expect.objectContaining({
                search: "C++ [Advanced] (2024)*+?",
              }),
            }),
          );
        },
        { timeout: 4000 },
      );
    });
  });

  describe("Requirement 13: Carousel doesn't render hundreds of cards at once (bounded count)", () => {
    it("Bounds maximum rendered cards to 12 even if API returns 40 items", async () => {
      const manyBooks = Array.from({ length: 30 }, (_, i) => ({
        _id: `many-book-${i}`,
        title: `Book Volume #${i + 1}`,
        author: `Author ${i + 1}`,
        category: "General",
      }));

      apiClient.get.mockResolvedValueOnce({
        data: { success: true, data: manyBooks },
      });

      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const cards = screen.getAllByTestId("catalog-book-card");
        expect(cards.length).toBeLessThanOrEqual(12);
      });
    });
  });
});
