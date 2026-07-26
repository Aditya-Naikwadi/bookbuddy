import { useState, useEffect, useCallback } from "react";
import { Globe, Users, Database, Activity, RefreshCw } from "lucide-react";
import adminApi from "../../../api/adminApi";

const SystemOverview = () => {
  const [stats, setStats] = useState(null);
  const [colleges, setColleges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOverviewData = useCallback(async () => {
    try {
      const statsData = await adminApi.getOverview();
      setStats(statsData);

      const collegesData = await adminApi.listColleges();
      setColleges(collegesData);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch system overview metrics.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setError("");
    fetchOverviewData();
  };

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        fetchOverviewData();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [fetchOverviewData]);

  const formatStorage = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
            Global System Overview
          </h1>
          <p className="text-slate-600">
            Super Admin holistic view of the BookBuddy SaaS infrastructure.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors flex items-center gap-2 font-medium text-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Globe size={24} />
            </div>
            <span className="text-success text-sm font-bold flex items-center">
              Healthy
            </span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">
            Total Registered Colleges
          </h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {stats?.totalColleges || 0}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <Users size={24} />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">
            Active Students
          </h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {stats?.userCountsByRole?.student?.toLocaleString() || 0}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Database size={24} />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">
            Total Storage Used
          </h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {formatStorage(stats?.storageUsageBytes)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
              <Activity size={24} />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Active Loans</h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {stats?.activeLoans || 0}
          </p>
        </div>
      </div>

      {/* College Instance Health Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 text-slate-900">
          College Instance Health
        </h2>
        <div className="overflow-x-auto">
          {colleges.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              No colleges registered on the platform.
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-900">
                <tr>
                  <th className="p-3 font-semibold rounded-tl-lg">
                    Tenant / College
                  </th>
                  <th className="p-3 font-semibold">Code</th>
                  <th className="p-3 font-semibold">Active Students</th>
                  <th className="p-3 font-semibold">Storage Used</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold rounded-tr-lg">Details</th>
                </tr>
              </thead>
              <tbody>
                {colleges.map((college) => (
                  <tr
                    key={college._id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-3 font-bold text-slate-900">
                      {college.name}
                    </td>
                    <td className="p-3 font-mono text-xs">{college.code}</td>
                    <td className="p-3">
                      {(college.metrics?.activeStudents || 0).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {formatStorage(college.metrics?.storageUsageBytes || 0)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(college.status)}`}
                      >
                        {college.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-xs text-slate-500">
                        {college.contactEmail
                          ? college.contactEmail
                          : "No contact email"}
                      </div>
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

export default SystemOverview;
