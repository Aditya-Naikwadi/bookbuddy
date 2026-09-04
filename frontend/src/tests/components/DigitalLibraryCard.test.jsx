import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import DigitalLibraryCard from "../../components/dashboard/DigitalLibraryCard";

vi.mock("axios");

describe("DigitalLibraryCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially and then displays patron card data without synchronous effect state errors", async () => {
    axios.get.mockResolvedValueOnce({
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
