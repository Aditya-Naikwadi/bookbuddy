import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Shield,
  UserCheck,
  UserX,
  Key,
  LogIn,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import adminApi from "../../../api/adminApi";
import OpsHeader from "../../../components/ops/OpsHeader";
import OpsSeverityBadge from "../../../components/ops/OpsSeverityBadge";
import OpsDataTable from "../../../components/ops/OpsDataTable";
import useAuthStore from "../../../store/authStore";

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  // Filters State
  const [search, setSearch] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  // Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { startImpersonating } = useAuthStore();

  const fetchUsers = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setIsLoading(true);
        const collegeList = await adminApi.listColleges();
        if (isMounted) setColleges(collegeList || []);

        const res = await adminApi.getUsers({
          search: search || undefined,
          collegeId: collegeFilter || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        });

        if (isMounted) setUsers(res.data || []);
      } catch (err) {
        console.error(err);
        if (isMounted) setError("Failed to load user directory.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [reloadToken, search, collegeFilter, roleFilter, statusFilter]);

  const handleToggleUserStatus = async (user) => {
    const nextStatus = user.status === "active" ? "disabled" : "active";
    const nextMembership =
      user.membershipStatus === "active" ? "suspended" : "active";
    if (
      !window.confirm(
        `Are you sure you want to set status for ${user.name} to ${nextStatus.toUpperCase()} (${nextMembership})?`,
      )
    ) {
      return;
    }

    try {
      await adminApi.updateUserStatus(user._id, {
        status: nextStatus,
        membershipStatus: nextMembership,
        isActive: nextStatus === "active",
      });
      setMessage({
        type: "success",
        text: `User ${user.name} status updated to ${nextStatus}.`,
      });
      fetchUsers();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to update user status.",
      });
    }
  };

  const handleRoleChangeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser || !newRole) return;

    setIsSubmitting(true);
    try {
      await adminApi.updateUserRole(selectedUser._id, newRole);
      setMessage({
        type: "success",
        text: `Role for ${selectedUser.name} changed to ${newRole}.`,
      });
      setIsRoleModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to update role.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (user) => {
    if (
      !window.confirm(
        `Generate a new temporary password for ${user.name} (${user.email})?`,
      )
    ) {
      return;
    }

    try {
      const res = await adminApi.resetUserPassword(user._id);
      setTempPassword(res.tempPassword);
      setSelectedUser(user);
      setMessage({
        type: "success",
        text: `Password reset successfully for ${user.name}.`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to reset password.",
      });
    }
  };

  const handleImpersonate = async (user) => {
    if (
      !window.confirm(
        `Perform Impersonation: You will log in as ${user.name} (${user.email}). Continue?`,
      )
    ) {
      return;
    }

    try {
      const res = await adminApi.impersonateUser(user._id);
      const impersonationToken = res.token || res.accessToken;
      const impersonatedUser = res.user || user;

      if (impersonationToken) {
        await startImpersonating(impersonationToken, impersonatedUser);
        const targetPath =
          user.role === "college-admin" || user.role === "college_admin"
            ? "/college-admin"
            : user.role === "general"
              ? "/general-dashboard"
              : "/student-dashboard";

        navigate(targetPath, { replace: true });
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to impersonate user.");
    }
  };

  const columns = [
    {
      header: "User Identity",
      key: "name",
      render: (val, row) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-ink text-xs">
            {val}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-muted font-normal">
            ID: {row.studentId || "N/A"} · {row.email}
          </div>
        </div>
      ),
    },
    {
      header: "Institution Scope",
      key: "collegeId",
      render: (val) => {
        const name = val?.name || "Global / System Wide";
        const code = val?.code ? ` (${val.code})` : "";
        return (
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {name}
            {code}
          </span>
        );
      },
    },
    {
      header: "Security Role",
      key: "role",
      render: (val) => {
        const isSuper = val === "super-admin" || val === "super_admin";
        const isAdmin = val === "college-admin" || val === "admin";

        return (
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isSuper
                ? "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800"
                : isAdmin
                  ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
            }`}
          >
            {val || "student"}
          </span>
        );
      },
    },
    {
      header: "Account Status",
      key: "status",
      render: (val, row) => {
        const isAct = val === "active" || row.isActive;
        return (
          <OpsSeverityBadge
            status={isAct ? "active" : "suspended"}
            label={isAct ? "Active" : "Suspended"}
            size="sm"
          />
        );
      },
    },
    {
      header: "Actions",
      key: "actions",
      sortable: false,
      render: (_, row) => {
        const isAct = row.status === "active" || row.isActive;
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setSelectedUser(row);
                setNewRole(row.role || "student");
                setIsRoleModalOpen(true);
              }}
              title="Change Role"
              className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium shadow-xs"
            >
              <Shield className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleToggleUserStatus(row)}
              title={isAct ? "Suspend User" : "Activate User"}
              className={`p-1.5 border rounded-lg text-xs font-medium shadow-xs ${
                isAct
                  ? "bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  : "bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              }`}
            >
              {isAct ? (
                <UserX className="w-3.5 h-3.5" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={() => handleResetPassword(row)}
              title="Force Reset Password"
              className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs shadow-xs"
            >
              <Key className="w-3.5 h-3.5" />
            </button>

            {row.role !== "super-admin" && (
              <button
                onClick={() => handleImpersonate(row)}
                title="Impersonate User Session"
                className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg text-xs flex items-center gap-1 shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-void text-slate-900 dark:text-ink font-sans pb-12">
      <OpsHeader
        title="User Directory & Access Governance"
        subtitle="Search, audit, suspend, reassign roles, reset passwords, and impersonate user accounts across all campus tenants"
        onRefresh={fetchUsers}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Notification Banner */}
        {message.text && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center justify-between border shadow-xs ${
              message.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage({ type: "", text: "" })}
              className="font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Temporary Password Display Banner */}
        {tempPassword && selectedUser && (
          <div className="bg-amber-950/60 border border-amber-600/80 rounded-xl p-4 font-mono space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 uppercase flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                TEMPORARY PASSWORD GENERATED FOR {selectedUser.name} (
                {selectedUser.email})
              </span>
              <button
                onClick={() => {
                  setTempPassword("");
                  setShowTempPassword(false);
                  setSelectedUser(null);
                }}
                className="text-xs text-amber-400 hover:underline font-bold"
              >
                CLOSE
              </button>
            </div>
            <div className="flex items-center gap-3">
              <code className="bg-slate-950 text-emerald-400 px-3 py-1.5 rounded-lg border border-slate-800 text-sm font-bold tracking-wider">
                {showTempPassword ? tempPassword : "••••••••••••"}
              </code>
              <button
                type="button"
                onClick={() => setShowTempPassword(!showTempPassword)}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-lg transition-colors"
                title={showTempPassword ? "Hide password" : "Show password"}
              >
                {showTempPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  alert("Temporary password copied to clipboard!");
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-lg"
              >
                COPY PASSWORD
              </button>
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-edge pb-2">
            <span className="text-xs font-bold text-slate-900 dark:text-ink tracking-tight flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />{" "}
              Filter User Records ({users.length})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search name, email, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-deep border border-slate-200 dark:border-edge rounded-xl text-slate-900 dark:text-ink focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <select
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-deep border border-slate-200 dark:border-edge rounded-xl text-slate-900 dark:text-ink focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">All Institutions</option>
              {colleges.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-deep border border-slate-200 dark:border-edge rounded-xl text-slate-900 dark:text-ink focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">All Roles</option>
              <option value="student">Student</option>
              <option value="college-admin">College Admin</option>
              <option value="super-admin">Super Admin</option>
              <option value="general">General User</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-deep border border-slate-200 dark:border-edge rounded-xl text-slate-900 dark:text-ink focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">All Account Statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="invited">Invited</option>
            </select>
          </div>
        </div>

        {/* User Directory Table */}
        <OpsDataTable
          columns={columns}
          data={users}
          isLoading={isLoading}
          searchPlaceholder="Filter table results..."
          emptyMessage="No matching user records found in directory."
        />

        {/* ROLE MODIFICATION MODAL */}
        {isRoleModalOpen && selectedUser && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono">
            <div className="bg-slate-900 border border-indigo-600/60 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                REASSIGN ROLE FOR {selectedUser.name}
              </h3>
              <p className="text-xs text-slate-400">
                Email: <strong>{selectedUser.email}</strong> | Current Role:{" "}
                <strong className="text-indigo-300">{selectedUser.role}</strong>
              </p>

              <form
                onSubmit={handleRoleChangeSubmit}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">
                    Target Access Role *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 mt-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                    required
                  >
                    <option value="student">student (College Scoped)</option>
                    <option value="college-admin">
                      college-admin (Tenant Admin)
                    </option>
                    <option value="super-admin">
                      super-admin (Global System Admin)
                    </option>
                    <option value="general">
                      general (Public Reader Access)
                    </option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoleModalOpen(false);
                      setSelectedUser(null);
                    }}
                    className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded font-bold"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold shadow-lg"
                  >
                    {isSubmitting ? "UPDATING..." : "CONFIRM ROLE UPDATE"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
