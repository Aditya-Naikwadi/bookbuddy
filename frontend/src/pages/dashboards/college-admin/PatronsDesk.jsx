import { useState, useMemo } from "react";
import {
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
  Search,
  X,
  BookOpen,
  Receipt,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";
import apiClient from "../../../api/client";

const EMPTY_ARRAY = [];

export default function PatronsDesk() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatronId, setSelectedPatronId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState("");
  const [studentId, setStudentId] = useState("");

  const { data: patronsData, isLoading } = useQuery({
    queryKey: ["allPatrons"],
    queryFn: () => collegeAdminApi.getAllPatrons(),
  });

  const { data: patronDetailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ["patronDetail", selectedPatronId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/dashboards/college-admin/patrons/${selectedPatronId}`,
      );
      return res.data;
    },
    enabled: !!selectedPatronId,
  });

  const createPatronMutation = useMutation({
    mutationFn: (payload) => collegeAdminApi.createStudentPatron(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allPatrons"] });
      setIsModalOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setDepartment("");
      setStudentId("");
    },
  });

  const patrons = patronsData?.data || EMPTY_ARRAY;

  const filteredPatrons = useMemo(() => {
    return patrons.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.studentId?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && p.isActive !== false) ||
        (statusFilter === "inactive" && p.isActive === false);

      return matchesSearch && matchesStatus;
    });
  }, [patrons, searchQuery, statusFilter]);

  const patronDetail = patronDetailData?.data || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
            ILS MODULE 04 — PATRON & MEMBER MANAGEMENT
          </span>
          <h1 className="text-3xl font-serif font-bold text-white mt-1">
            Student & Faculty Membership Roster
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage library memberships, track individual borrowing activity, and
            enroll new campus patrons.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs text-white shadow-lg shadow-indigo-600/20 transition-colors shrink-0"
        >
          <UserPlus size={16} /> Add Individual Student Patron
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
            Total Patrons
          </div>
          <div className="text-2xl font-mono font-extrabold text-white mt-1">
            {patrons.length}
          </div>
          <div className="text-[10px] text-indigo-400 mt-0.5">
            Enrolled Accounts
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
            Active Status
          </div>
          <div className="text-2xl font-mono font-extrabold text-emerald-400 mt-1">
            {patrons.filter((p) => p.isActive !== false).length}
          </div>
          <div className="text-[10px] text-emerald-400/80 mt-0.5">
            Good Standing
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
            Filtered View
          </div>
          <div className="text-2xl font-mono font-extrabold text-cyan-400 mt-1">
            {filteredPatrons.length}
          </div>
          <div className="text-[10px] text-cyan-400/80 mt-0.5">
            Matching Criteria
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
            Departments
          </div>
          <div className="text-2xl font-mono font-extrabold text-purple-400 mt-1">
            {new Set(patrons.map((p) => p.department || "General")).size}
          </div>
          <div className="text-[10px] text-purple-400/80 mt-0.5">
            Academic Units
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search patron by name, email, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {["all", "active", "inactive"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold capitalize transition-colors ${
                statusFilter === st
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin text-indigo-400" size={20} /> Loading
          patrons roster...
        </div>
      ) : filteredPatrons.length === 0 ? (
        <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No registered patrons found matching your search.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase border-b border-slate-800">
              <tr>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Student / Card ID</th>
                <th className="p-3.5">Campus Email</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {filteredPatrons.map((patron) => (
                <tr key={patron._id} className="hover:bg-slate-800/30">
                  <td className="p-3.5 font-bold text-white">{patron.name}</td>
                  <td className="p-3.5 font-mono text-indigo-300">
                    {patron.studentId || "—"}
                  </td>
                  <td className="p-3.5 font-mono text-slate-400">
                    {patron.email}
                  </td>
                  <td className="p-3.5">
                    {patron.department || patron.major || "General"}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        patron.isActive !== false
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {patron.isActive !== false
                        ? "Active Member"
                        : "Suspended"}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => setSelectedPatronId(patron._id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Patron Details Modal */}
      {selectedPatronId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Patron Membership Profile
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  ID: {selectedPatronId}
                </p>
              </div>
              <button
                onClick={() => setSelectedPatronId(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            {isDetailLoading ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                <p className="text-xs mt-2">Loading member record...</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl space-y-1">
                  <div className="font-bold text-base text-white">
                    {patronDetail.name}
                  </div>
                  <div className="text-slate-400 font-mono">
                    {patronDetail.email}
                  </div>
                  <div className="text-slate-400">
                    Student ID:{" "}
                    <span className="font-mono text-indigo-300">
                      {patronDetail.studentId || "N/A"}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-mono font-bold text-slate-300 uppercase mb-2 flex items-center gap-1.5">
                    <BookOpen size={14} className="text-indigo-400" />
                    <span>Active Borrowing History</span>
                  </h4>
                  {patronDetail.loans?.length === 0 ? (
                    <p className="text-slate-500 italic">
                      No current books checked out.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {patronDetail.loans?.map((loan) => (
                        <div
                          key={loan._id}
                          className="p-2 bg-slate-950 rounded-lg flex justify-between items-center"
                        >
                          <span className="font-bold text-slate-200 truncate max-w-[200px]">
                            {loan.bookId?.title || "Book"}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            Due: {new Date(loan.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-mono font-bold text-slate-300 uppercase mb-2 flex items-center gap-1.5">
                    <Receipt size={14} className="text-rose-400" />
                    <span>Outstanding Fines</span>
                  </h4>
                  {patronDetail.fines?.length === 0 ? (
                    <p className="text-emerald-400 text-xs">
                      No pending fines. Account in good standing.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {patronDetail.fines?.map((fine) => (
                        <div
                          key={fine._id}
                          className="p-2 bg-slate-950 rounded-lg flex justify-between items-center"
                        >
                          <span className="text-slate-300">
                            {fine.reason || "Late return fine"}
                          </span>
                          <span className="font-mono font-bold text-rose-400">
                            ₹{fine.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Patron Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-white">
              Enroll New Student Patron
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPatronMutation.mutate({
                  name,
                  email,
                  password,
                  studentId,
                  department,
                  role: "student",
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Student ID Number *
                </label>
                <input
                  type="text"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. STU-2026-089"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Campus Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Initial Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 pr-9 text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Department / Academic Major
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPatronMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {createPatronMutation.isPending
                    ? "Enrolling..."
                    : "Enroll Patron"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
