import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { Badge } from "../../components/ui/Badge";
import DigitalLibraryCard from "../../components/dashboard/DigitalLibraryCard";
import DonutChart from "../../components/general/DonutChart";
import SparklineChart from "../../components/general/SparklineChart";
import BookDataState from "../../components/common/BookDataState";
import { HelpModal } from "../../components/HelpModal";
import { OnboardingTour } from "../../components/OnboardingTour";
import ImpersonationBanner from "../../components/ImpersonationBanner";
import useAuthStore from "../../store/authStore";
import { PaymentDialog } from "../../components/student/loans-tracker/PaymentDialog";
import * as paymentApi from "../../api/paymentApi";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock("../../api/paymentApi", () => ({
  createRazorpayOrder: vi.fn(),
  verifyRazorpayPayment: vi.fn(),
}));
vi.mock("../../context/ConfigContext.jsx", () => ({
  useConfig: () => ({ razorpayKeyId: "rzp_test_mock_key" }),
}));

describe("PatronWidgets Component Suite", () => {
  describe("Badge Component", () => {
    it("renders children content correctly", () => {
      render(<Badge>Active</Badge>);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("applies custom class names alongside default styles", () => {
      render(<Badge className="custom-badge">New</Badge>);
      const badge = screen.getByText("New");
      expect(badge.className).toContain("custom-badge");
      expect(badge.className).toContain("rounded-full");
    });
  });

  describe("DigitalLibraryCard Component", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders loading state initially and then displays patron card data without synchronous effect state errors", async () => {
      vi.spyOn(axios, "get").mockResolvedValueOnce({
        data: {
          token: "mock-jwt-token-12345",
          user: {
            name: "Jane Student",
            rollNumber: "CS-2026-042",
            department: "Computer Science",
            email: "jane@campus.edu",
          },
        },
      });

      render(<DigitalLibraryCard />);

      await waitFor(() => {
        expect(screen.getByText("Jane Student")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Roll No: CS-2026-042 • Dept: Computer Science"),
      ).toBeInTheDocument();
    });
  });

  describe("Dashboard Data & Chart Widgets", () => {
    describe("DonutChart", () => {
      it("renders 0% and empty legend message when data is empty or sum is 0", () => {
        render(<DonutChart data={[]} />);
        expect(screen.getByText("0%")).toBeInTheDocument();
        expect(
          screen.getByText(/No category distribution available/i),
        ).toBeInTheDocument();
      });

      it("renders accurate calculated percentages when populated with genre data", () => {
        const data = [
          { label: "Computer Science", value: 50, color: "#6366F1" },
          { label: "Literature", value: 50, color: "#10B981" },
        ];
        render(<DonutChart data={data} />);
        expect(screen.getByText("100%")).toBeInTheDocument();
        expect(screen.getByText("Computer Science")).toBeInTheDocument();
        expect(screen.getByText("Literature")).toBeInTheDocument();
      });
    });

    describe("SparklineChart", () => {
      it("renders neutral baseline indicator when series data is null, empty, or all zeros", () => {
        const { container } = render(<SparklineChart data={[]} />);
        const line = container.querySelector("line");
        expect(line).toBeInTheDocument();
        expect(line.getAttribute("stroke-dasharray")).toBe("4 4");
      });

      it("renders SVG sparkline path when valid series data is provided", () => {
        const { container } = render(
          <SparklineChart
            data={[10, 20, 15, 30, 25]}
            width={100}
            height={40}
          />,
        );
        const paths = container.querySelectorAll("path");
        expect(paths.length).toBeGreaterThan(0);
      });
    });

    describe("BookDataState", () => {
      it("renders loading skeleton when isLoading is true", () => {
        const { container } = render(
          <BookDataState isLoading={true}>
            <div>Loaded Content</div>
          </BookDataState>,
        );
        expect(screen.queryByText("Loaded Content")).not.toBeInTheDocument();
        expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
      });

      it("renders error banner with retry option when isError is true", () => {
        const handleRetry = vi.fn();
        render(
          <BookDataState
            isError={true}
            error={{ message: "Failed to fetch catalog" }}
            onRetry={handleRetry}
          >
            <div>Loaded Content</div>
          </BookDataState>,
        );
        expect(
          screen.getByText(/Unable to load book catalog data/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Failed to fetch catalog/i),
        ).toBeInTheDocument();

        const retryBtn = screen.getByRole("button", { name: /retry/i });
        fireEvent.click(retryBtn);
        expect(handleRetry).toHaveBeenCalledTimes(1);
      });

      it("renders dark-theme compliant empty state with college name and action buttons", () => {
        const handleClear = vi.fn();
        render(
          <BookDataState
            isEmpty={true}
            collegeName="Oxford Campus Library"
            onClearFilter={handleClear}
          >
            <div>Loaded Content</div>
          </BookDataState>,
        );
        expect(screen.getByText(/No books found/i)).toBeInTheDocument();
        expect(
          screen.getByText(
            /No catalog items currently match Oxford Campus Library/i,
          ),
        ).toBeInTheDocument();

        const clearBtn = screen.getByRole("button", { name: /clear filters/i });
        fireEvent.click(clearBtn);
        expect(handleClear).toHaveBeenCalledTimes(1);
      });

      it("renders children content when data is loaded successfully", () => {
        render(
          <BookDataState isLoading={false} isError={false} isEmpty={false}>
            <div>Loaded Catalog Item</div>
          </BookDataState>,
        );
        expect(screen.getByText("Loaded Catalog Item")).toBeInTheDocument();
      });
    });
  });

  describe("Help Center & Onboarding Tour Component Suite (F9.1 - F9.4)", () => {
    const mockOnClose = vi.fn();
    const mockOnStartTour = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    describe("F9.2 — Searchable Help Modal", () => {
      it("surfaces relevant article when searching a known keyword without page reload", () => {
        render(
          <HelpModal
            isOpen={true}
            onClose={mockOnClose}
            onStartTour={mockOnStartTour}
          />,
        );

        const searchInput =
          screen.getByPlaceholderText(/Search help articles/i);
        fireEvent.change(searchInput, { target: { value: "fine" } });

        expect(
          screen.getByText("Fine Settlement & Razorpay Payments"),
        ).toBeInTheDocument();
        expect(
          screen.queryByText("Borrowing Books & Loan Renewals"),
        ).not.toBeInTheDocument();
      });

      it("F9.4 — Replay tour button triggers tour on demand", () => {
        render(
          <HelpModal
            isOpen={true}
            onClose={mockOnClose}
            onStartTour={mockOnStartTour}
          />,
        );

        const replayBtn = screen.getByRole("button", {
          name: /Replay Onboarding Tour/i,
        });
        fireEvent.click(replayBtn);

        expect(mockOnClose).toHaveBeenCalled();
        expect(mockOnStartTour).toHaveBeenCalled();
      });
    });

    describe("F9.3 — First-Run Onboarding Tour & Profile State", () => {
      it("automatically triggers tour for new user with hasSeenOnboarding: false", () => {
        const newUser = { id: "u123", hasSeenOnboarding: false };

        render(<OnboardingTour user={newUser} />);

        expect(
          screen.getByText(/Platform Onboarding Tour/i),
        ).toBeInTheDocument();
        expect(screen.getByText("Welcome to BookBuddy!")).toBeInTheDocument();
      });

      it("does NOT automatically trigger tour for returning user with hasSeenOnboarding: true", () => {
        const returningUser = { id: "u456", hasSeenOnboarding: true };

        const { container } = render(<OnboardingTour user={returningUser} />);

        expect(container.firstChild).toBeNull();
      });

      it("F9.4 — forces tour launch when forceStart is true regardless of profile state", () => {
        const returningUser = { id: "u456", hasSeenOnboarding: true };

        render(<OnboardingTour user={returningUser} forceStart={true} />);

        expect(
          screen.getByText(/Platform Onboarding Tour/i),
        ).toBeInTheDocument();
        expect(screen.getByText("Welcome to BookBuddy!")).toBeInTheDocument();
      });
    });
  });

  describe("ImpersonationBanner component", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it("renders nothing when user is not impersonated", () => {
      useAuthStore.setState({ isImpersonated: false });
      const { container } = render(<ImpersonationBanner />);
      expect(container.firstChild).toBeNull();
    });

    it("renders impersonation banner when active", () => {
      localStorage.setItem("originalSuperAdminToken", "fake-admin-token");
      useAuthStore.setState({
        isImpersonated: true,
        user: { name: "Test User", email: "test@example.com" },
      });

      render(<ImpersonationBanner />);
      expect(
        screen.getByText(/IMPERSONATION SESSION ACTIVE/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/TEST USER/i)).toBeInTheDocument();
      expect(screen.getByText(/STOP IMPERSONATING/i)).toBeInTheDocument();
    });
  });

  describe("PaymentDialog Component (Razorpay PCI-DSS Integration)", () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();
    const sampleFine = {
      _id: "fine123",
      amount: 150.0,
      overdueDays: 5,
      loanId: { bookId: { title: "Design Patterns" } },
    };

    beforeEach(() => {
      vi.clearAllMocks();
      window.Razorpay = vi.fn().mockImplementation(function () {
        this.open = vi.fn();
        this.on = vi.fn();
      });
    });

    it("renders fine settlement summary and pay button", () => {
      render(
        <PaymentDialog
          isOpen={true}
          onClose={mockOnClose}
          fineItem={sampleFine}
          totalAmount={150.0}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByText(/Fine Payment Gateway/i)).toBeInTheDocument();
      expect(
        screen.getByText(/PCI-DSS Compliant Hosted Gateway/i),
      ).toBeInTheDocument();
      expect(screen.getByText("₹150.00")).toBeInTheDocument();
    });

    it("initiates Razorpay order creation when pay button is clicked", async () => {
      paymentApi.createRazorpayOrder.mockResolvedValue({
        order_id: "order_mock_123",
        amount: 15000,
        currency: "INR",
        key_id: "rzp_test_mock_key",
      });

      render(
        <PaymentDialog
          isOpen={true}
          onClose={mockOnClose}
          fineItem={sampleFine}
          totalAmount={150.0}
          onConfirm={mockOnConfirm}
        />,
      );

      const payBtn = screen.getByRole("button", { name: /Pay ₹150.00 Now/i });
      fireEvent.click(payBtn);

      await waitFor(() => {
        expect(paymentApi.createRazorpayOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            fineId: "fine123",
          }),
        );
      });
    });
  });
});
