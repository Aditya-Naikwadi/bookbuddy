import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "../../components/ui/Badge";

describe("Badge component", () => {
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
