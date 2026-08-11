import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BookCoverImage } from "../../components/common/BookCoverImage";

describe("BookCoverImage component", () => {
  it("renders image tag when valid src is provided", () => {
    render(<BookCoverImage src="https://example.com/cover.jpg" alt="Test Book" />);
    const img = screen.getByAltText("Test Book");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/cover.jpg");
  });

  it("renders fallback cover UI when src is missing", () => {
    render(<BookCoverImage src="" fallbackTitle="Design Patterns" fallbackCategory="Engineering" />);
    expect(screen.getByText("Design Patterns")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("switches to fallback cover UI when image fails to load", () => {
    render(<BookCoverImage src="https://example.com/broken.jpg" alt="Broken Cover" fallbackTitle="Fallback Book" />);
    const img = screen.getByAltText("Broken Cover");
    fireEvent.error(img);
    expect(screen.getByText("Fallback Book")).toBeInTheDocument();
  });
});
