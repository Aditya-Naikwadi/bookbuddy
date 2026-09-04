import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { BookDetail } from "../../components/BookDetail";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as watchApi from "../../api/watchApi";

vi.mock("../../api/watchApi");
vi.mock("../../api/reviewApi", () => ({
  getBookReviews: vi.fn().mockResolvedValue({
    data: [],
    page: 1,
    hasMore: false,
  }),
  submitBookReview: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("BookDetail Component - Notify Me & Watching State", () => {
  const outOfStockBook = {
    _id: "book123",
    title: "The Pragmatic Programmer",
    author: "Andrew Hunt",
    category: "Software",
    copiesTotal: 2,
    copiesAvailable: 0,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("Renders 'Notify me when available' button when user is not watching out-of-stock book", async () => {
    watchApi.getWatchStatus.mockResolvedValue({
      success: true,
      isWatching: false,
    });

    render(<BookDetail book={outOfStockBook} currentUserId="user1" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId("notify-me-button")).toBeDefined();
    });

    expect(screen.getByText("Notify me when available")).toBeDefined();
  });

  test("Acceptance Criteria: Server-side watch status renders 'Watching' state instead of original button (simulating page reload)", async () => {
    // Simulating page load / reload where server returns isWatching: true
    watchApi.getWatchStatus.mockResolvedValue({
      success: true,
      isWatching: true,
    });

    render(<BookDetail book={outOfStockBook} currentUserId="user1" />, {
      wrapper: createWrapper(),
    });

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

    render(<BookDetail book={outOfStockBook} currentUserId="user1" />, {
      wrapper: createWrapper(),
    });

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
