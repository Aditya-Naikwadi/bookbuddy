import { useState } from "react";
import { UserPlus, Loader2, Eye, EyeOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";

export default function PatronsDesk() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState("");

  const { data: patronsData, isLoading } = useQuery({
    queryKey: ["allPatrons"],
    queryFn: () => collegeAdminApi.getAllPatrons(),
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
    },
  });

  const patrons = patronsData?.data || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
            Patrons Roster
          </span>
          <h1 className="text-3xl font-serif font-bold text-white mt-1">
            Student & Faculty Roster
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            View registered patrons, student library access privileges, and
            enroll individual accounts.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 font-medium px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs text-white shadow-lg transition-colors"
        >
          <UserPlus size={16} /> Add Individual Student Patron
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin text-indigo-400" size={20} /> Loading
          patrons roster...
        </div>
      ) : patrons.length === 0 ? (
        <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No registered patrons found for this campus. Use bulk CSV upload or
          add individual patron.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase">
              <tr>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {patrons.map((patron) => (
                <tr key={patron._id}>
                  <td className="p-3.5 font-bold text-white">{patron.name}</td>
                  <td className="p-3.5 font-mono text-slate-400">
                    {patron.email}
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase font-mono text-[10px]">
                      {patron.role}
                    </span>
                  </td>
                  <td className="p-3.5">{patron.department || "General"}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                      Active Patron
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
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
                  department,
                  role: "student",
                });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Campus Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Initial Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 pr-9 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
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
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Department / Major
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPatronMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white"
                >
                  {createPatronMutation.isPending
                    ? "Creating..."
                    : "Save Patron"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
