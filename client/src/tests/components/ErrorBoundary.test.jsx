import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";

const ProblemChild = () => {
  throw new Error("Render error test");
};

describe("ErrorBoundary component", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Normal Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Normal Content")).toBeInTheDocument();
  });

  it("catches rendering errors and displays default fallback UI", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>Custom Error UI</div>}>
        <ProblemChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
