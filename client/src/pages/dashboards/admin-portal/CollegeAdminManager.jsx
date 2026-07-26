import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  UserPlus,
  AlertTriangle,
  Check,
  RefreshCw,
  Globe,
} from "lucide-react";
import adminApi from "../../../api/adminApi";

const CollegeAdminManager = () => {
  const [colleges, setColleges] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [collegeName, setCollegeName] = useState("");
  const [collegeCode, setCollegeCode] = useState("");
  const [collegeEmail, setCollegeEmail] = useState("");
  const [collegePhone, setCollegePhone] = useState("");
  const [collegeAddress, setCollegeAddress] = useState("");

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminStudentId, setAdminStudentId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [selectedCollegeId, setSelectedCollegeId] = useState("");

  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchData = useCallback(async () => {
    try {
      const collegesData = await adminApi.listColleges();
      setColleges(collegesData);

      const adminsData = await adminApi.getAdmins();
      setAdmins(adminsData);

      if (collegesData.length > 0) {
        setSelectedCollegeId((prev) => prev || collegesData[0]._id);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Failed to fetch directories." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setMessage({ type: "", text: "" });
    fetchData();
  };

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        fetchData();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  const handleCreateCollege = async (e) => {
    e.preventDefault();
    if (!collegeName || !collegeCode) {
      setMessage({ type: "error", text: "Name and Code are required." });
      return;
    }
    try {
      await adminApi.createCollege({
        name: collegeName,
        code: collegeCode,
        contactEmail: collegeEmail,
        contactPhone: collegePhone,
        address: collegeAddress,
      });
      setMessage({
        type: "success",
        text: "College registered successfully as PENDING.",
      });
      setCollegeName("");
      setCollegeCode("");
      setCollegeEmail("");
      setCollegePhone("");
      setCollegeAddress("");
      fetchData();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to register college.",
      });
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (
      !adminName ||
      !adminEmail ||
      !adminStudentId ||
      !adminPassword ||
      !selectedCollegeId
    ) {
      setMessage({
        type: "error",
        text: "All fields are required to provision an admin.",
      });
      return;
    }
    try {
      await adminApi.createAdmin({
        studentId: adminStudentId,
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        collegeId: selectedCollegeId,
      });
      setMessage({
        type: "success",
        text: "Admin account provisioned successfully.",
      });
      setAdminName("");
      setAdminEmail("");
      setAdminStudentId("");
      setAdminPassword("");
      fetchData();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to provision admin.",
      });
    }
  };

  const handleStatusChange = async (collegeId, newStatus) => {
    const confirmMsg =
      `Are you sure you want to transition this college to ${newStatus.toUpperCase()}?` +
      (newStatus === "archived"
        ? " WARNING: This is a terminal state and cannot be undone."
        : "");

    if (!window.confirm(confirmMsg)) return;

    try {
      await adminApi.updateCollegeStatus(collegeId, newStatus);
      setMessage({
        type: "success",
        text: `College status updated to ${newStatus}.`,
      });
      fetchData();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to update college status.",
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-800";
      case "suspended":
        return "bg-amber-100 text-amber-800";
      case "archived":
        return "bg-rose-100 text-rose-800";
      case "pending":
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">
            College & Admin Onboarding
          </h1>
          <p className="text-slate-600">
            Provision colleges, create admins, and enforce administrative
            lifecycles.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors flex items-center gap-2 font-medium text-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-lg text-sm border flex items-center gap-2 ${
            message.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {message.type === "error" ? (
            <AlertTriangle size={18} />
          ) : (
            <Check size={18} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Provision New College */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Globe className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">
              1. Onboard College
            </h2>
          </div>
          <form onSubmit={handleCreateCollege} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                College Name
              </label>
              <input
                type="text"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Stanford University"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Code
              </label>
              <input
                type="text"
                value={collegeCode}
                onChange={(e) => setCollegeCode(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="e.g. STAN"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={collegeEmail}
                onChange={(e) => setCollegeEmail(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="admin@college.edu"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={collegePhone}
                onChange={(e) => setCollegePhone(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="+1 555-1234"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={collegeAddress}
                onChange={(e) => setCollegeAddress(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="California, USA"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Register College (Pending)
            </button>
          </form>
        </div>

        {/* Provision New Admin */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <UserPlus className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">
              2. Provision Admin
            </h2>
          </div>
          <form onSubmit={handleCreateAdmin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned College
              </label>
              <select
                value={selectedCollegeId}
                onChange={(e) => setSelectedCollegeId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {colleges.map((c) => (
                  <option
                    key={c._id}
                    value={c._id}
                    disabled={c.status === "archived"}
                  >
                    {c.name} ({c.code}){" "}
                    {c.status === "archived" ? "[ARCHIVED]" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin ID (studentId)
              </label>
              <input
                type="text"
                value={adminStudentId}
                onChange={(e) => setAdminStudentId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="e.g. STAN_ADM_01"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="Sarah Jenkins"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="sarah.jenkins@college.edu"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Temporary Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Activate Admin (Transitions to Active)
            </button>
          </form>
        </div>

        {/* Directory & Status Control */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Shield className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">
              3. College Status Control
            </h2>
          </div>
          <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
            {colleges.map((c) => (
              <div
                key={c._id}
                className="p-3 border rounded-lg hover:shadow-xs transition-shadow space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      {c.name}
                    </h4>
                    <p className="text-xs font-mono text-slate-400">
                      Code: {c.code}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(c.status)}`}
                  >
                    {c.status}
                  </span>
                </div>

                {c.status !== "archived" && (
                  <div className="flex gap-2 pt-1">
                    {c.status === "active" && (
                      <button
                        onClick={() => handleStatusChange(c._id, "suspended")}
                        className="flex-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs py-1 rounded hover:bg-amber-100 transition-colors font-medium"
                      >
                        Suspend
                      </button>
                    )}
                    {c.status === "suspended" && (
                      <button
                        onClick={() => handleStatusChange(c._id, "active")}
                        className="flex-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs py-1 rounded hover:bg-emerald-100 transition-colors font-medium"
                      >
                        Reinstate
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChange(c._id, "archived")}
                      className="flex-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs py-1 rounded hover:bg-rose-100 transition-colors font-medium"
                    >
                      Archive
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* College Admins list */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 text-slate-900">
          Provisioned College Admins
        </h2>
        <div className="overflow-x-auto">
          {admins.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              No college admins registered yet.
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-900">
                <tr>
                  <th className="p-3 font-semibold rounded-tl-lg">
                    Admin Name
                  </th>
                  <th className="p-3 font-semibold">Admin ID (studentId)</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold rounded-tr-lg">
                    College Assigned
                  </th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr
                    key={admin._id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-3 font-bold text-slate-900">
                      {admin.name}
                    </td>
                    <td className="p-3 font-mono text-xs">{admin.studentId}</td>
                    <td className="p-3">{admin.email}</td>
                    <td className="p-3 font-bold text-slate-800">
                      {admin.collegeId
                        ? `${admin.collegeId.name} (${admin.collegeId.code})`
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollegeAdminManager;
