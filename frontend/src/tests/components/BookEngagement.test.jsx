import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, test, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BookCoverImage } from "../../components/common/BookCoverImage";
import { BookDetail } from "../../components/BookDetail";
import ReviewList from "../../components/ReviewList";
import StarRatingInput from "../../components/StarRatingInput";
import AddToListPicker from "../../components/AddToListPicker";
import * as watchApi from "../../api/watchApi";
import * as reviewApi from "../../api/reviewApi";
import * as readingListApi from "../../api/readingListApi";

vi.mock("../../api/watchApi");
vi.mock("../../api/reviewApi", () => ({
  getBookReviews: vi.fn(),
  submitBookReview: vi.fn(),
}));
vi.mock("../../api/readingListApi", () => ({
  getReadingLists: vi.fn(),
  createReadingList: vi.fn(),
  addReadingListItem: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe("BookEngagement Component Suite", () => {
  describe("BookCoverImage Component", () => {
    it("renders image tag when valid src is provided", () => {
      render(
        <BookCoverImage src="https://example.com/cover.jpg" alt="Test Book" />,
      );
      const img = screen.getByAltText("Test Book");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/cover.jpg");
    });

    it("renders fallback cover UI when src is missing", () => {
      render(
        <BookCoverImage
          src=""
          fallbackTitle="Design Patterns"
          fallbackCategory="Engineering"
        />,
      );
      expect(screen.getByText("Design Patterns")).toBeInTheDocument();
      expect(screen.getByText("Engineering")).toBeInTheDocument();
    });

    it("switches to fallback cover UI when image fails to load", () => {
      render(
        <BookCoverImage
          src="https://example.com/broken.jpg"
          alt="Broken Cover"
          fallbackTitle="Fallback Book"
        />,
      );
      const img = screen.getByAltText("Broken Cover");
      fireEvent.error(img);
      expect(screen.getByText("Fallback Book")).toBeInTheDocument();
    });
  });

  describe("BookDetail Component - Notify Me & Watching State", () => {
    const outOfStockBook = {
      _id: "book123",
      title: "The Pragmatic Programmer",
      author: "Andrew Hunt",
      category: "Software",
      copiesTotal: 2,
      copiesAvailable: 0,
    };

    let queryClient;
    beforeEach(() => {
      vi.resetAllMocks();
      queryClient = createTestQueryClient();
    });

    test("Renders 'Notify me when available' button when user is not watching out-of-stock book", async () => {
      watchApi.getWatchStatus.mockResolvedValue({
        success: true,
        isWatching: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <BookDetail book={outOfStockBook} currentUserId="user1" />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("notify-me-button")).toBeDefined();
      });

      expect(screen.getByText("Notify me when available")).toBeDefined();
    });

    test("Acceptance Criteria: Server-side watch status renders 'Watching' state instead of original button (simulating page reload)", async () => {
      watchApi.getWatchStatus.mockResolvedValue({
        success: true,
        isWatching: true,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <BookDetail book={outOfStockBook} currentUserId="user1" />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("watching-button")).toBeDefined();
      });

      expect(screen.getByText("Watching")).toBeDefined();
    });

    test("Clicking 'Notify me when available' invokes watchBook API mutation", async () => {
      watchApi.getWatchStatus.mockResolvedValue({
        success: true,
        isWatching: false,
      });
      watchApi.watchBook.mockResolvedValue({ success: true });

      render(
        <QueryClientProvider client={queryClient}>
          <BookDetail book={outOfStockBook} currentUserId="user1" />
        </QueryClientProvider>,
      );

      const button = await screen.findByTestId("notify-me-button");
      await waitFor(() => {
        expect(button.hasAttribute("disabled")).toBe(false);
      });

      fireEvent.click(button);

      await waitFor(() => {
        expect(watchApi.watchBook).toHaveBeenCalledWith("book123");
      });
    });
  });

  describe("ReviewList Component UI & Client-Side Validation", () => {
    let queryClient;
    beforeEach(() => {
      queryClient = createTestQueryClient();
      vi.clearAllMocks();
    });

    it("Submit button is disabled until a star value is selected", async () => {
      reviewApi.getBookReviews.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        hasMore: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ReviewList bookId="book-123" currentUserId="user-1" />
        </QueryClientProvider>,
      );

      const submitBtn = screen.getByTestId("submit-review-button");
      expect(submitBtn).toBeDisabled();

      const star4 = screen.getByTestId("star-button-4");
      fireEvent.click(star4);

      expect(submitBtn).not.toBeDisabled();
    });

    it("Acceptance Criteria: Attempting to submit with no star selected is blocked client-side before network request fires", async () => {
      reviewApi.getBookReviews.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        hasMore: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ReviewList bookId="book-123" currentUserId="user-1" />
        </QueryClientProvider>,
      );

      const form = screen.getByTestId("review-form");
      fireEvent.submit(form);

      expect(reviewApi.submitBookReview).not.toHaveBeenCalled();
      expect(screen.getByTestId("review-error-message")).toHaveTextContent(
        "Please select a star rating before submitting.",
      );
    });

    it("Pre-fills form with existing user review for editing rather than duplicate submission", async () => {
      const existingReview = {
        _id: "rev-1",
        userId: { _id: "user-1", name: "Existing User" },
        bookId: "book-123",
        rating: 5,
        text: "My existing great review",
        status: "approved",
      };

      reviewApi.getBookReviews.mockResolvedValue({
        data: [existingReview],
        total: 1,
        page: 1,
        hasMore: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ReviewList bookId="book-123" currentUserId="user-1" />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("review-textarea")).toHaveValue(
          "My existing great review",
        );
      });

      const submitBtn = screen.getByTestId("submit-review-button");
      expect(submitBtn).toHaveTextContent("Update Review");
    });
  });

  describe("StarRatingInput Component", () => {
    it("renders 5 star buttons by default", () => {
      render(<StarRatingInput value={0} onChange={() => {}} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(5);
    });

    it("triggers onChange with selected rating when a star is clicked", () => {
      const handleChange = vi.fn();
      render(<StarRatingInput value={0} onChange={handleChange} />);
      const thirdStar = screen.getByTestId("star-button-3");

      fireEvent.click(thirdStar);
      expect(handleChange).toHaveBeenCalledWith(3);
    });

    it("does not trigger onChange when disabled or readOnly", () => {
      const handleChange = vi.fn();
      render(<StarRatingInput value={3} onChange={handleChange} disabled />);
      const star = screen.getByTestId("star-button-4");

      fireEvent.click(star);
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("AddToListPicker Component", () => {
    let queryClient;
    beforeEach(() => {
      queryClient = createTestQueryClient();
      vi.clearAllMocks();
    });

    it("renders trigger button and opens modal when clicked", async () => {
      readingListApi.getReadingLists.mockResolvedValue({
        success: true,
        data: [
          {
            _id: "list-123",
            name: "CS Core Books",
            visibility: "private",
            items: [],
          },
        ],
      });

      render(
        <QueryClientProvider client={queryClient}>
          <AddToListPicker bookId="book-999" />
        </QueryClientProvider>,
      );

      const triggerButton = screen.getByRole("button", {
        name: /add to list/i,
      });
      expect(triggerButton).toBeInTheDocument();

      fireEvent.click(triggerButton);

      expect(screen.getByText(/add to reading list/i)).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText("CS Core Books")).toBeInTheDocument();
      });
    });

    it("works unmodified when passed a book object or bookId string", async () => {
      readingListApi.getReadingLists.mockResolvedValue({
        success: true,
        data: [],
      });

      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <AddToListPicker
            book={{ _id: "book-object-777", title: "Clean Architecture" }}
          />
        </QueryClientProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /add to list/i }));
      expect(screen.getByText(/add to reading list/i)).toBeInTheDocument();

      unmount();

      const queryClient2 = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient2}>
          <AddToListPicker bookId="book-string-888" />
        </QueryClientProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /add to list/i }));
      expect(screen.getByText(/add to reading list/i)).toBeInTheDocument();
    });

    it("handles list item addition when a shelf is clicked", async () => {
      readingListApi.getReadingLists.mockResolvedValue({
        success: true,
        data: [
          {
            _id: "shelf-1",
            name: "Architecture Shelf",
            visibility: "private",
            items: [],
          },
        ],
      });
      readingListApi.addReadingListItem.mockResolvedValue({
        success: true,
        data: { _id: "shelf-1" },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <AddToListPicker bookId="book-456" />
        </QueryClientProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /add to list/i }));

      const shelfButton = await screen.findByText("Architecture Shelf");
      fireEvent.click(shelfButton);

      await waitFor(() => {
        expect(readingListApi.addReadingListItem).toHaveBeenCalledWith(
          "shelf-1",
          {
            bookId: "book-456",
          },
        );
      });
    });

    it("allows creating a new list inline", async () => {
      readingListApi.getReadingLists.mockResolvedValue({
        success: true,
        data: [],
      });
      readingListApi.createReadingList.mockResolvedValue({
        _id: "new-shelf-99",
        name: "Exam Prep Shelf",
        visibility: "private",
      });
      readingListApi.addReadingListItem.mockResolvedValue({
        success: true,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <AddToListPicker bookId="book-100" />
        </QueryClientProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /add to list/i }));

      const createToggleBtn = await screen.findByRole("button", {
        name: /create new list/i,
      });
      fireEvent.click(createToggleBtn);

      const nameInput = screen.getByPlaceholderText(/list name/i);
      fireEvent.change(nameInput, { target: { value: "Exam Prep Shelf" } });

      const submitBtn = screen.getByRole("button", { name: /create & add/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(readingListApi.createReadingList).toHaveBeenCalledWith({
          name: "Exam Prep Shelf",
          title: "Exam Prep Shelf",
          description: "",
          visibility: "private",
        });
        expect(readingListApi.addReadingListItem).toHaveBeenCalledWith(
          "new-shelf-99",
          {
            bookId: "book-100",
          },
        );
      });
    });
  });
});
