import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ThemeProvider } from "../../context/ThemeContext";
import { ThemeToggle } from "../../components/common/ThemeToggle";

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
