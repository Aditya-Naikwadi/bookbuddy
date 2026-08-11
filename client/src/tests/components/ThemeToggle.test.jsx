import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ThemeProvider } from "../../context/ThemeContext";
import { ThemeToggle } from "../../components/common/ThemeToggle";

describe("ThemeToggle Component", () => {
  it("renders accessible theme toggle button and switches theme", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    expect(button).toBeDefined();
    expect(button.getAttribute("aria-label")).toMatch(/Switch to (light|dark) theme/i);

    const initialAriaPressed = button.getAttribute("aria-pressed");

    // Click toggle button
    fireEvent.click(button);

    // Verify aria-pressed changed
    const newAriaPressed = button.getAttribute("aria-pressed");
    expect(newAriaPressed).not.toBe(initialAriaPressed);

    // Verify document root class reflects light/dark theme
    const isDark = newAriaPressed === "true";
    expect(document.documentElement.classList.contains(isDark ? "dark" : "light")).toBe(true);
  });
});
