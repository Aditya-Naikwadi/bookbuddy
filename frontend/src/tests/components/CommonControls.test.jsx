import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../../components/ui/Button";
import { ThemeProvider } from "../../context/ThemeContext";
import { ThemeToggle } from "../../components/common/ThemeToggle";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";

const ProblemChild = () => {
  throw new Error("Render error test");
};

describe("CommonControls Component Suite", () => {
  describe("Button Component", () => {
    it("renders children text correctly", () => {
      render(<Button>Click Me</Button>);
      expect(
        screen.getByRole("button", { name: /click me/i }),
      ).toBeInTheDocument();
    });

    it("handles onClick events", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Clickable</Button>);
      fireEvent.click(screen.getByRole("button", { name: /clickable/i }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("applies primary variant classes by default", () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole("button", { name: /primary/i });
      expect(button.className).toContain("bg-ember");
    });
  });

  describe("ThemeToggle Component", () => {
    it("enforces dark theme across the application", () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>,
      );

      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  describe("ErrorBoundary Component", () => {
    it("renders children when no error occurs", () => {
      render(
        <ErrorBoundary>
          <div>Normal Content</div>
        </ErrorBoundary>,
      );
      expect(screen.getByText("Normal Content")).toBeInTheDocument();
    });

    it("catches rendering errors and displays default fallback UI", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      render(
        <ErrorBoundary>
          <ProblemChild />
        </ErrorBoundary>,
      );
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reload page/i }),
      ).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it("renders custom fallback prop when provided on error", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      render(
        <ErrorBoundary fallback={<div>Custom Error UI</div>}>
          <ProblemChild />
        </ErrorBoundary>,
      );
      expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });
});
