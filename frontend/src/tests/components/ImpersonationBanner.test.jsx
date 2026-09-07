import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ImpersonationBanner from "../../components/ImpersonationBanner";
import useAuthStore from "../../store/authStore";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

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
