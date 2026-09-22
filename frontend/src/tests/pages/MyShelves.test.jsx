import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MyShelves from "../../pages/MyShelves";
import * as readingListApi from "../../api/readingListApi";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../api/readingListApi", () => ({
  getReadingLists: vi.fn(),
  createReadingList: vi.fn(),
  updateReadingList: vi.fn(),
  deleteReadingList: vi.fn(),
  removeReadingListItem: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("MyShelves Page Component", () => {
  let queryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("terminates loading immediately and displays empty state when shelves API returns an empty array { data: [] }", async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MyShelves />
      </QueryClientProvider>,
    );

    // Verifies loading state terminates immediately without timing out
    expect(await screen.findByText("No Shelves Found", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(
      screen.getByText("Get started by creating your first reading shelf!"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Loading your shelves..."),
    ).not.toBeInTheDocument();
  });

  it("terminates loading immediately and displays empty state when shelves API returns raw empty array []", async () => {
    readingListApi.getReadingLists.mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <MyShelves />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No Shelves Found", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(
      screen.getByText("Get started by creating your first reading shelf!"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Loading your shelves..."),
    ).not.toBeInTheDocument();
  });

  it("renders grid of reading list cards fetched from backend", async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [
        {
          _id: "list-1",
          name: "Computer Science Core",
          description: "Essential CS books",
          visibility: "college",
          items: [
            {
              _id: "item-1",
              bookId: { title: "Clean Code", author: "Robert Martin" },
            },
          ],
        },
        {
          _id: "list-2",
          name: "Private Math Shelf",
          description: "Algebra & Calculus",
          visibility: "private",
          items: [],
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MyShelves />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("Computer Science Core", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Private Math Shelf")).toBeInTheDocument();
    expect(screen.getByText(/1 book/i)).toBeInTheDocument();
  });

  it('opens shelf item detail drawer/modal when "Open & Reorder" is clicked', async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [
        {
          _id: "list-1",
          name: "Algorithms Shelf",
          visibility: "private",
          items: [
            {
              _id: "item-101",
              bookId: { title: "Introduction to Algorithms", author: "CLRS" },
            },
            {
              _id: "item-102",
              bookId: { title: "Algorithm Design", author: "Kleinberg" },
            },
          ],
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MyShelves />
      </QueryClientProvider>,
    );

    await screen.findByText("Algorithms Shelf");
    const openBtn = await screen.findByRole("button", {
      name: /open & reorder/i,
    });
    fireEvent.click(openBtn);

    expect(
      screen.getByText("Introduction to Algorithms"),
    ).toBeInTheDocument();
    expect(screen.getByText("Algorithm Design")).toBeInTheDocument();
  });

  it("allows creating a new shelf via modal", async () => {
    readingListApi.getReadingLists.mockResolvedValue({
      success: true,
      data: [],
    });
    readingListApi.createReadingList.mockResolvedValue({
      _id: "new-shelf-1",
      name: "New Test Shelf",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MyShelves />
      </QueryClientProvider>,
    );

    const createBtn = await screen.findByRole("button", {
      name: /create new shelf/i,
    });
    fireEvent.click(createBtn);

    const nameInput = screen.getByPlaceholderText(/operating systems/i);
    fireEvent.change(nameInput, { target: { value: "New Test Shelf" } });

    const submitBtns = screen.getAllByRole("button", {
      name: /create shelf/i,
    });
    const modalSubmitBtn = submitBtns[submitBtns.length - 1];
    fireEvent.click(modalSubmitBtn);

    await waitFor(() => {
      expect(readingListApi.createReadingList).toHaveBeenCalledWith({
        name: "New Test Shelf",
        title: "New Test Shelf",
        description: "",
        visibility: "private",
      });
    });
  });

  it("renders error state when fetch fails and allows retry", async () => {
    readingListApi.getReadingLists.mockRejectedValue(new Error("Network Error"));

    render(
      <QueryClientProvider client={queryClient}>
        <MyShelves />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/failed to load shelves/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
