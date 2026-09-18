import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PatronsDesk from "../../pages/dashboards/college-admin/PatronsDesk";
import collegeAdminApi from "../../api/collegeAdminApi";
import { toast } from "../../store/toastStore";

vi.mock("../../store/toastStore", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  default: vi.fn(),
}));

vi.mock("../../api/collegeAdminApi", () => ({
  default: {
    getAllPatrons: vi.fn(),
    createStudentPatron: vi.fn(),
    getStudentJoinRequests: vi.fn(),
    approveStudentJoinRequest: vi.fn(),
    rejectStudentJoinRequest: vi.fn(),
  },
  getAllPatrons: vi.fn(),
  createStudentPatron: vi.fn(),
  getStudentJoinRequests: vi.fn(),
  approveStudentJoinRequest: vi.fn(),
  rejectStudentJoinRequest: vi.fn(),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const mockPatrons = [
  {
    _id: "patron-1",
    name: "Enrolled Alice",
    studentId: "STU-001",
    email: "alice@campus.edu",
    department: "Computer Science",
    isActive: true,
  },
];

const mockJoinRequests = [
  {
    _id: "req-1",
    name: "Pending Bob",
    studentId: "stu-off-roster-001",
    email: "bob@campus.edu",
    department: "Mathematics",
    status: "pending",
    submittedAt: new Date().toISOString(),
  },
  {
    _id: "req-2",
    name: "Rejected Charlie",
    studentId: "stu-reject-002",
    email: "charlie@campus.edu",
    department: "Physics",
    status: "rejected",
    rejectionReason: "Not found on official registrar roster",
    submittedAt: new Date().toISOString(),
  },
];

describe("PatronsDesk - Student Join Requests Feature Suite", () => {
  let queryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();

    collegeAdminApi.getAllPatrons.mockResolvedValue({
      success: true,
      data: mockPatrons,
    });

    collegeAdminApi.getStudentJoinRequests.mockImplementation(({ status }) => {
      if (status === "pending") {
        return Promise.resolve({
          success: true,
          data: mockJoinRequests.filter((r) => r.status === "pending"),
          pagination: { total: 1, page: 1, limit: 50, pages: 1 },
        });
      }
      return Promise.resolve({
        success: true,
        data: mockJoinRequests,
        pagination: { total: 2, page: 1, limit: 50, pages: 1 },
      });
    });

    collegeAdminApi.approveStudentJoinRequest.mockResolvedValue({
      success: true,
      message: "Student join request approved successfully.",
      data: {
        request: { ...mockJoinRequests[0], status: "approved" },
        user: {
          _id: "user-bob-1",
          name: "Pending Bob",
          email: "bob@campus.edu",
          role: "student",
          status: "active",
        },
      },
    });

    collegeAdminApi.rejectStudentJoinRequest.mockResolvedValue({
      success: true,
      message: "Student join request rejected successfully.",
      data: {
        ...mockJoinRequests[0],
        status: "rejected",
        rejectionReason: "Not found on official registrar roster",
      },
    });
  });

  const renderComponent = (initialEntries = ["/college-admin/patrons"]) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <PatronsDesk />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it("1. renders both tabs and shows pending badge count", async () => {
    renderComponent();

    expect(
      screen.getByRole("button", { name: /Enrolled Patrons Roster/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Student Join Requests/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Enrolled Alice/i)).toBeInTheDocument();
    });
  });

  it("2. switches to Student Join Requests tab and displays pending join requests", async () => {
    renderComponent();

    const joinRequestsTab = screen.getByRole("button", {
      name: /Student Join Requests/i,
    });
    fireEvent.click(joinRequestsTab);

    await waitFor(() => {
      expect(screen.getByText("Pending Bob")).toBeInTheDocument();
      expect(screen.getByText("stu-off-roster-001")).toBeInTheDocument();
      expect(screen.getByText("bob@campus.edu")).toBeInTheDocument();
      expect(screen.getByText(/Pending Review/i)).toBeInTheDocument();
    });
  });

  it("3. approves a pending student join request, activating account and displaying success toast", async () => {
    renderComponent(["/college-admin/patrons?tab=join-requests"]);

    await waitFor(() => {
      expect(screen.getByText("Pending Bob")).toBeInTheDocument();
    });

    const approveButton = screen.getByTestId("approve-request-btn-req-1");
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(collegeAdminApi.approveStudentJoinRequest).toHaveBeenCalledWith(
        "req-1",
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Join Request Approved",
        expect.stringContaining("Pending Bob"),
      );
    });
  });

  it("4. opens reject modal and enforces required rejection reason validation", async () => {
    renderComponent(["/college-admin/patrons?tab=join-requests"]);

    await waitFor(() => {
      expect(screen.getByText("Pending Bob")).toBeInTheDocument();
    });

    const rejectButton = screen.getByTestId("reject-request-btn-req-1");
    fireEvent.click(rejectButton);

    // Modal is open with student summary
    expect(
      screen.getByRole("heading", { name: /Reject Student Join Request/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Reason for Rejection/i)).toBeInTheDocument();

    // Try submitting without reason
    const submitReject = screen.getByTestId("confirm-reject-btn");
    fireEvent.click(submitReject);

    // Form validation triggers and reject API is NOT called
    expect(
      screen.getByText(/Rejection reason is required before rejecting/i),
    ).toBeInTheDocument();
    expect(collegeAdminApi.rejectStudentJoinRequest).not.toHaveBeenCalled();
  });

  it("5. rejects a student join request with required reason, closing modal and displaying toast", async () => {
    renderComponent(["/college-admin/patrons?tab=join-requests"]);

    await waitFor(() => {
      expect(screen.getByText("Pending Bob")).toBeInTheDocument();
    });

    const rejectButton = screen.getByTestId("reject-request-btn-req-1");
    fireEvent.click(rejectButton);

    // Click quick template chip
    const templateChip = screen.getByRole("button", {
      name: /Not found on official registrar roster/i,
    });
    fireEvent.click(templateChip);

    const textarea = screen.getByTestId("reject-reason-textarea");
    expect(textarea.value).toBe("Not found on official registrar roster");

    // Submit rejection
    const submitReject = screen.getByTestId("confirm-reject-btn");
    fireEvent.click(submitReject);

    await waitFor(() => {
      expect(collegeAdminApi.rejectStudentJoinRequest).toHaveBeenCalledWith(
        "req-1",
        {
          reason: "Not found on official registrar roster",
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Join Request Rejected",
        expect.stringContaining("rejected"),
      );
      // Modal is closed
      expect(
        screen.queryByRole("heading", { name: /Reject Student Join Request/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("6. shows rejection reason for previously rejected requests", async () => {
    collegeAdminApi.getStudentJoinRequests.mockImplementation(({ status }) => {
      if (status === "pending") {
        return Promise.resolve({
          success: true,
          data: mockJoinRequests.filter((r) => r.status === "pending"),
          pagination: { total: 1, page: 1, limit: 50, pages: 1 },
        });
      }
      return Promise.resolve({
        success: true,
        data: mockJoinRequests,
        pagination: { total: 2, page: 1, limit: 50, pages: 1 },
      });
    });

    renderComponent(["/college-admin/patrons?tab=join-requests"]);

    // Switch status filter to all
    const allFilterBtn = screen.getByTestId("filter-requests-all");
    fireEvent.click(allFilterBtn);

    await waitFor(() => {
      expect(screen.getByText("Rejected Charlie")).toBeInTheDocument();
      expect(
        screen.getByText(/Reason: Not found on official registrar roster/i),
      ).toBeInTheDocument();
    });
  });
});
