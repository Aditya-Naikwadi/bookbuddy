import { FileSearch, Clock } from 'lucide-react';

const AuditLogs = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Security & Audit Logs</h1>
      <p className="text-slate-600">System-wide forensic tracking of administrative and user actions.</p>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <FileSearch className="text-indigo-600" />
            <h2 className="text-xl font-bold">System Event Logs</h2>
          </div>
          <div className="flex gap-2">
            <input type="date" className="p-2 border border-slate-300 rounded-lg text-sm" />
            <select className="p-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option>All Severities</option>
              <option>INFO</option>
              <option>WARN</option>
              <option>CRITICAL</option>
            </select>
            <button className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 text-sm">
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 font-mono">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-900 font-sans">
              <tr>
                <th className="p-3 font-semibold rounded-tl-lg">Timestamp</th>
                <th className="p-3 font-semibold">Severity</th>
                <th className="p-3 font-semibold">User ID (Actor)</th>
                <th className="p-3 font-semibold">Event Description</th>
                <th className="p-3 font-semibold rounded-tr-lg">IP Address</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 flex items-center gap-2 text-xs"><Clock size={14} className="text-slate-400" /> 2026-10-24 14:02:11</td>
                <td className="p-3"><span className="bg-success/10 text-success px-2 py-0.5 rounded font-bold text-xs">INFO</span></td>
                <td className="p-3 font-bold text-indigo-600">COL-ADM-102</td>
                <td className="p-3 text-slate-800">Modified fine rule for 'Course Reserves' (10 to 15 INR)</td>
                <td className="p-3 text-xs text-slate-500">192.168.1.45</td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 flex items-center gap-2 text-xs"><Clock size={14} className="text-slate-400" /> 2026-10-24 13:45:00</td>
                <td className="p-3"><span className="bg-danger/10 text-danger px-2 py-0.5 rounded font-bold text-xs">CRITICAL</span></td>
                <td className="p-3 font-bold text-indigo-600">STU-1001</td>
                <td className="p-3 text-slate-800">Failed login attempt (5 consecutive) - Account locked</td>
                <td className="p-3 text-xs text-slate-500">203.0.113.89</td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 flex items-center gap-2 text-xs"><Clock size={14} className="text-slate-400" /> 2026-10-24 12:10:44</td>
                <td className="p-3"><span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-xs">WARN</span></td>
                <td className="p-3 font-bold text-indigo-600">COL-ADM-005</td>
                <td className="p-3 text-slate-800">Deleted 400 catalog records in bulk operation</td>
                <td className="p-3 text-xs text-slate-500">10.0.4.21</td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 flex items-center gap-2 text-xs"><Clock size={14} className="text-slate-400" /> 2026-10-24 09:00:01</td>
                <td className="p-3"><span className="bg-success/10 text-success px-2 py-0.5 rounded font-bold text-xs">INFO</span></td>
                <td className="p-3 font-bold text-slate-900">SYSTEM</td>
                <td className="p-3 text-slate-800">Automated daily backup completed successfully</td>
                <td className="p-3 text-xs text-slate-500">127.0.0.1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
