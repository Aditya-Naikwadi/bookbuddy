import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DonutChart from "../../components/general/DonutChart";
import SparklineChart from "../../components/general/SparklineChart";
import BookDataState from "../../components/common/BookDataState";

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
        <SparklineChart data={[10, 20, 15, 30, 25]} width={100} height={40} />,
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
      expect(screen.getByText(/Failed to fetch catalog/i)).toBeInTheDocument();

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
