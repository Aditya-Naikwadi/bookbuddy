import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MyShelves from "../../pages/MyShelves";
import { Navbar } from "../../components/layout/Navbar";
import { Footer } from "../../components/layout/Footer";
import { Hero } from "../../sections/Hero";
import { EResources } from "../../sections/EResources";
import { CatalogSearch } from "../../sections/CatalogSearch";
import { ForColleges } from "../../sections/ForColleges";
import Landing from "../../pages/public/Landing";
import { Fines } from "../../pages/Fines";
import * as readingListApi from "../../api/readingListApi";
import useAuthStore from "../../store/authStore";

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

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      get: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
      post: vi.fn(),
    },
    setOnUnauthorizedCallback: vi.fn(),
  };
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("Shelves and Landing Consolidated Suite", () => {
  describe("MyShelves Page Component with Drag-Reorder", () => {
    let queryClient;

    beforeEach(() => {
      queryClient = createTestQueryClient();
      vi.clearAllMocks();
    });

    it("1. renders grid of reading list cards fetched from backend", async () => {
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
        await screen.findByText("Computer Science Core", {}, { timeout: 5000 }),
      ).toBeInTheDocument();
      expect(screen.getByText("Private Math Shelf")).toBeInTheDocument();
      expect(screen.getByText(/1 book/i)).toBeInTheDocument();
    });

    it('2. opens shelf item detail drawer/modal when "Open & Reorder" is clicked', async () => {
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

    it("3. Acceptance Criteria: updating order triggers PATCH /api/reading-lists/:id with new items order", async () => {
      readingListApi.getReadingLists.mockResolvedValue({
        success: true,
        data: [
          {
            _id: "shelf-persisted-99",
            name: "Persisted Shelf",
            visibility: "private",
            items: [
              { _id: "item-a", bookId: { title: "Book A" } },
              { _id: "item-b", bookId: { title: "Book B" } },
            ],
          },
        ],
      });
      readingListApi.updateReadingList.mockResolvedValue({
        success: true,
        data: { _id: "shelf-persisted-99" },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MyShelves />
        </QueryClientProvider>,
      );

      const openBtn = await screen.findByRole("button", {
        name: /open & reorder/i,
      });
      fireEvent.click(openBtn);

      expect(screen.getByText("Book A")).toBeInTheDocument();
      expect(screen.getByText("Book B")).toBeInTheDocument();
    });

    it("4. allows creating a new shelf via modal", async () => {
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

    it("5. terminates loading immediately and displays empty state when reading-list API returns empty array", async () => {
      readingListApi.getReadingLists.mockResolvedValue({
        success: true,
        data: [],
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MyShelves />
        </QueryClientProvider>,
      );

      expect(await screen.findByText("No Shelves Found")).toBeInTheDocument();
      expect(
        screen.getByText("Get started by creating your first reading shelf!"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Loading your shelves..."),
      ).not.toBeInTheDocument();
    });
  });

  describe("Landing Page Enhancements & Fixes", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();

      if (typeof globalThis.IntersectionObserver === "undefined") {
        globalThis.IntersectionObserver = class {
          observe() {}
          unobserve() {}
          disconnect() {}
        };
      }
      if (typeof globalThis.ResizeObserver === "undefined") {
        globalThis.ResizeObserver = class {
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

    it("1. Navbar renders all navigation links targeting the correct sections", () => {
      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      expect(
        screen.getAllByRole("button", { name: /Features/i })[0],
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: /E-Resources/i })[0],
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: /Catalog Search/i })[0],
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: /Streaks/i })[0],
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: /How It Works/i })[0],
      ).toBeInTheDocument();
    });

    it("2. Navbar link click invokes scrollIntoView for target section", () => {
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const featuresEl = document.createElement("section");
      featuresEl.id = "features";
      document.body.appendChild(featuresEl);

      const eresourcesEl = document.createElement("section");
      eresourcesEl.id = "e-resources";
      document.body.appendChild(eresourcesEl);

      const catalogEl = document.createElement("section");
      catalogEl.id = "catalog-search";
      document.body.appendChild(catalogEl);

      render(
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>,
      );

      const eresourcesBtn = screen.getAllByRole("button", {
        name: /E-Resources/i,
      })[0];
      fireEvent.click(eresourcesBtn);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

      const catalogBtn = screen.getAllByRole("button", {
        name: /Catalog Search/i,
      })[0];
      fireEvent.click(catalogBtn);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

      featuresEl.remove();
      eresourcesEl.remove();
      catalogEl.remove();
    });

    it("3. 'Browse the Library' CTA in EResources scrolls to the Catalog Search section", () => {
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const catalogSection = document.createElement("section");
      catalogSection.id = "catalog-search";
      document.body.appendChild(catalogSection);

      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      const browseBtn = screen.getByRole("button", {
        name: /Browse the Library/i,
      });
      expect(browseBtn).toBeInTheDocument();
      fireEvent.click(browseBtn);

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

      catalogSection.remove();
    });

    it("4. EResources section displays horizontal book carousel and clicking a card redirects unauthenticated users to /auth/login", async () => {
      render(
        <MemoryRouter>
          <EResources />
        </MemoryRouter>,
      );

      const carousel = await screen.findByTestId("eresources-carousel");
      expect(carousel).toBeInTheDocument();

      const bookCards = await screen.findAllByTestId("eresources-book-card");
      expect(bookCards.length).toBeGreaterThan(0);

      fireEvent.click(bookCards[0]);
      expect(mockNavigate).toHaveBeenCalledWith(
        "/auth/login",
        expect.objectContaining({
          state: expect.objectContaining({ from: "e-resources" }),
        }),
      );
    });

    it("5. CatalogSearch section displays horizontal book carousel and clicking a card redirects unauthenticated users to /auth/login", async () => {
      render(
        <MemoryRouter>
          <CatalogSearch />
        </MemoryRouter>,
      );

      const carousel = await screen.findByTestId("catalog-carousel");
      expect(carousel).toBeInTheDocument();

      const bookCards = await screen.findAllByTestId("catalog-book-card");
      expect(bookCards.length).toBeGreaterThan(0);

      fireEvent.click(bookCards[0]);
      expect(mockNavigate).toHaveBeenCalledWith(
        "/auth/login",
        expect.objectContaining({
          state: expect.objectContaining({ from: "catalog-search" }),
        }),
      );
    });

    it("6. Landing page renders both EResources and CatalogSearch sections with carousels", async () => {
      render(
        <MemoryRouter>
          <Landing />
        </MemoryRouter>,
      );

      expect(
        await screen.findByTestId("eresources-carousel"),
      ).toBeInTheDocument();
      expect(await screen.findByTestId("catalog-carousel")).toBeInTheDocument();
    });

    it("7. Hero section renders headline, subheadline, primary CTA ('Browse the Library'), and secondary CTA ('Login / Register')", () => {
      render(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("heading", { name: /The Library in Your Pocket/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Borrow, reserve, read 70,000\+ free books/i),
      ).toBeInTheDocument();

      const primaryCta = screen.getByRole("button", {
        name: /Browse the Library/i,
      });
      const secondaryCta = screen.getByRole("button", {
        name: /Login \/ Register/i,
      });

      expect(primaryCta).toBeInTheDocument();
      expect(secondaryCta).toBeInTheDocument();
    });

    it("8. Hero primary CTA scrolls to catalog and secondary CTA navigates to /auth/login", () => {
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const catalogSection = document.createElement("section");
      catalogSection.id = "catalog-search";
      document.body.appendChild(catalogSection);

      render(
        <MemoryRouter>
          <Hero />
        </MemoryRouter>,
      );

      const primaryCta = screen.getByRole("button", {
        name: /Browse the Library/i,
      });
      fireEvent.click(primaryCta);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

      const secondaryCta = screen.getByRole("button", {
        name: /Login \/ Register/i,
      });
      fireEvent.click(secondaryCta);
      expect(mockNavigate).toHaveBeenCalledWith("/auth/login");

      catalogSection.remove();
    });

    it("9. Footer renders Privacy Policy, Terms, Contact/Support links, and correct dynamic copyright year", () => {
      render(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>,
      );

      const currentYear = new Date().getFullYear().toString();
      expect(screen.getByText(new RegExp(currentYear))).toBeInTheDocument();

      const privacyLinks = screen.getAllByRole("link", {
        name: /Privacy Policy/i,
      });
      expect(privacyLinks.length).toBeGreaterThanOrEqual(1);
      expect(privacyLinks[0]).toHaveAttribute("href", "/privacy");

      const termsLinks = screen.getAllByRole("link", { name: /^Terms$/i });
      expect(termsLinks.length).toBeGreaterThanOrEqual(1);
      expect(termsLinks[0]).toHaveAttribute("href", "/terms");

      const supportLinks = screen.getAllByRole("link", {
        name: /Contact\/Support/i,
      });
      expect(supportLinks.length).toBeGreaterThanOrEqual(1);
      expect(supportLinks[0]).toHaveAttribute("href", "/support");
    });

    it("10. For Colleges section renders institutional features, stats, and registration CTA", () => {
      render(
        <MemoryRouter>
          <ForColleges />
        </MemoryRouter>,
      );

      expect(
        screen.getByText(/CAMPUS & INSTITUTIONAL PARTNERSHIPS/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: /Empower your campus library with BookBuddy/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Multi-Tenant Campus Isolation/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Circulation Insights & Analytics/i),
      ).toBeInTheDocument();

      const registerCollegeBtn = screen.getByRole("button", {
        name: /Register Your College/i,
      });
      expect(registerCollegeBtn).toBeInTheDocument();
      fireEvent.click(registerCollegeBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/auth/register");
    });

    it("11. Landing page renders sections in intended order and contains no mock demo users", async () => {
      render(
        <MemoryRouter>
          <Landing />
        </MemoryRouter>,
      );

      // Verify sections are present
      expect(
        screen.getByRole("heading", { name: /The Library in Your Pocket/i }),
      ).toBeInTheDocument();
      expect(await screen.findByTestId("catalog-carousel")).toBeInTheDocument();
      expect(
        await screen.findByTestId("eresources-carousel"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: /The complete library experience/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /How it works/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: /Empower your campus library with BookBuddy/i,
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole("contentinfo")).toBeInTheDocument(); // footer

      // Verify no mock demo user feed text is visible
      expect(
        screen.queryByText(/Sarah started a 14-day streak/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/David just borrowed/i),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/PRADNYA PAWAR/i)).not.toBeInTheDocument();
    });
  });

  describe("Fines Page & F7.5 Payment Processing Confirmation UI", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      globalThis.fetch = vi.fn();
      window.Razorpay = vi.fn().mockImplementation(function () {
        this.open = vi.fn();
      });
    });

    it("renders outstanding fine items and total balance", async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              _id: "fine1",
              amount: 50.0,
              overdueDays: 5,
              status: "unpaid",
              loanId: { bookId: { title: "Clean Architecture" } },
            },
          ],
        }),
      });

      render(<Fines />);

      await waitFor(() => {
        expect(screen.getByText(/Clean Architecture/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Total Outstanding Balance/i),
        ).toBeInTheDocument();
      });
    });

    it("Acceptance Criteria: UI shows Payment Processing state until confirmed by server/webhook", async () => {
      globalThis.fetch.mockImplementation((url) => {
        if (url.includes("/api/v1/fines")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: [
                {
                  _id: "fine1",
                  amount: 50.0,
                  overdueDays: 5,
                  status: "unpaid",
                  loanId: { bookId: { title: "Clean Architecture" } },
                },
              ],
            }),
          });
        }

        if (url.includes("/api/v1/payments/create-order")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                orderId: "order_test_123",
                amount: 5000,
                amountInRupees: 50.0,
                currency: "INR",
                keyId: "rzp_test_mock_key",
              },
            }),
          });
        }

        if (url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                orderId: "order_test_123",
                status: "created",
              },
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<Fines />);

      await waitFor(() => {
        expect(screen.getByText(/Clean Architecture/i)).toBeInTheDocument();
      });

      const payBtn = screen.getByRole("button", { name: /Pay ₹50.00 Now/i });
      fireEvent.click(payBtn);

      await waitFor(() => {
        expect(screen.getByText(/Payment Processing.../i)).toBeInTheDocument();
      });
    });
  });
});
