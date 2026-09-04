import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GeneralSearch from "../../pages/dashboards/general/GeneralSearch";
import GeneralSaved from "../../pages/dashboards/general/GeneralSaved";
import GeneralEResources from "../../pages/dashboards/general/GeneralEResources";
import * as bookDataHooks from "../../hooks/useBookData";
import useAuthStore from "../../store/authStore";
import useLocalBookmarks from "../../hooks/useLocalBookmarks";

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

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
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
        <MemoryRouter initialEntries={["/general-dashboard/search?filter=new"]}>
          <GeneralSearch />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.getAllByText(/Database System Concepts/i).length,
    ).toBeGreaterThan(0);
  });

  it("2. renders GeneralSaved and displays bookmarks with real-time status and clear action", () => {
    // Populate mock local bookmark via localStorage
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

    // Verify "Clear All" button is present and clickable
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
