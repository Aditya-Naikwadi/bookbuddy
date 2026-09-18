import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Login from "../../pages/Login";
import { registrationApi } from "../../api/registrationApi";
import useAuthStore from "../../store/authStore";
import * as tenantUtils from "../../utils/tenantSubdomain";

vi.mock("../../context/ConfigContext", () => ({
  useConfig: () => ({
    googleClientId: "",
  }),
}));

const mockActiveColleges = [
  {
    _id: "college-1",
    name: "Massachusetts Institute of Technology",
    shortName: "MIT",
    code: "MIT",
    slug: "mit",
    domain: "mit.edu",
    status: "active",
    isActive: true,
  },
  {
    _id: "college-2",
    name: "Stanford University",
    shortName: "Stanford",
    code: "STAN",
    slug: "stanford",
    domain: "stanford.edu",
    status: "active",
    isActive: true,
  },
  {
    _id: "college-3",
    name: "Oxford University",
    shortName: "Oxford",
    code: "OXF",
    slug: "oxford",
    domain: "ox.ac.uk",
    status: "active",
    isActive: true,
  },
];

describe("Central Login - Searchable College Picker & Redirection", () => {
  let originalLocation;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    // Mock window.location for redirection tests
    originalLocation = window.location;
    delete window.location;
    window.location = {
      ...originalLocation,
      href: "http://localhost:5173/auth/login",
      assign: vi.fn(),
    };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it("renders searchable college picker on central login page and loads active colleges", async () => {
    vi.spyOn(tenantUtils, "getSubdomainTenantSlug").mockReturnValue(null);
    const getCollegesSpy = vi
      .spyOn(registrationApi, "getActiveColleges")
      .mockResolvedValue(mockActiveColleges);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Assert institution finder header
    expect(screen.getByText(/Student or Faculty Member\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Find your institution to sign in to your campus library/i)
    ).toBeInTheDocument();

    const searchInput = screen.getByRole("combobox", {
      name: /Search college institution/i,
    });
    expect(searchInput).toBeInTheDocument();

    // Verify active colleges API was called
    await waitFor(() => {
      expect(getCollegesSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("filters colleges dynamically as user types in the search input", async () => {
    vi.spyOn(tenantUtils, "getSubdomainTenantSlug").mockReturnValue(null);
    vi.spyOn(registrationApi, "getActiveColleges").mockResolvedValue(mockActiveColleges);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const searchInput = screen.getByRole("combobox", {
      name: /Search college institution/i,
    });

    // Focus input to open dropdown
    fireEvent.focus(searchInput);

    await waitFor(() => {
      expect(screen.getByText("Massachusetts Institute of Technology")).toBeInTheDocument();
      expect(screen.getByText("Stanford University")).toBeInTheDocument();
      expect(screen.getByText("Oxford University")).toBeInTheDocument();
    });

    // Type query "Stan"
    fireEvent.change(searchInput, { target: { value: "Stan" } });

    expect(screen.getByText("Stanford University")).toBeInTheDocument();
    expect(screen.queryByText("Massachusetts Institute of Technology")).not.toBeInTheDocument();
    expect(screen.queryByText("Oxford University")).not.toBeInTheDocument();

    // Clear search using clear button
    const clearBtn = screen.getByLabelText(/Clear college search/i);
    fireEvent.click(clearBtn);

    expect(searchInput.value).toBe("");
    expect(screen.getByText("Massachusetts Institute of Technology")).toBeInTheDocument();
  });

  it("shows empty state when no active college matches the search query", async () => {
    vi.spyOn(tenantUtils, "getSubdomainTenantSlug").mockReturnValue(null);
    vi.spyOn(registrationApi, "getActiveColleges").mockResolvedValue(mockActiveColleges);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const searchInput = screen.getByRole("combobox", {
      name: /Search college institution/i,
    });
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "NonExistentCollege123" } });

    await waitFor(() => {
      expect(
        screen.getByText(/No active institutions found matching "NonExistentCollege123"/i)
      ).toBeInTheDocument();
    });
  });

  it("redirects to <slug>.bookbuddy.com/login when a college is selected", async () => {
    vi.spyOn(tenantUtils, "getSubdomainTenantSlug").mockReturnValue(null);
    vi.spyOn(registrationApi, "getActiveColleges").mockResolvedValue(mockActiveColleges);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const searchInput = screen.getByRole("combobox", {
      name: /Search college institution/i,
    });
    fireEvent.focus(searchInput);

    await waitFor(() => {
      expect(screen.getByText("Massachusetts Institute of Technology")).toBeInTheDocument();
    });

    // Select MIT
    const mitOption = screen.getByRole("option", {
      name: /Massachusetts Institute of Technology/i,
    });
    fireEvent.click(mitOption);

    // Verify redirection to <slug>.bookbuddy.com/login
    expect(
      window.location.href === "https://mit.bookbuddy.com/login" ||
        window.location.assign.mock.calls.some(
          (call) => call[0] === "https://mit.bookbuddy.com/login"
        )
    ).toBe(true);

    // Verify redirecting transition notice
    expect(screen.getByText(/Redirecting to Massachusetts Institute of Technology portal/i)).toBeInTheDocument();
  });

  it("does not render the college picker on a tenant-scoped subdomain login page", () => {
    vi.spyOn(tenantUtils, "getSubdomainTenantSlug").mockReturnValue("mit");
    const getCollegesSpy = vi
      .spyOn(registrationApi, "getActiveColleges")
      .mockResolvedValue(mockActiveColleges);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // On tenant subdomain, picker is not shown as the central gateway
    expect(screen.queryByText(/Student or Faculty Member\?/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /Search college institution/i })
    ).not.toBeInTheDocument();
    expect(getCollegesSpy).not.toHaveBeenCalled();

    // Scoped indicator is rendered
    expect(screen.getByText(/Institution Scoped:/i)).toBeInTheDocument();
    expect(screen.getByText(/mit/i)).toBeInTheDocument();
  });
});
