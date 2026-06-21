import { Globe, Users, Database, Activity } from 'lucide-react';

const SystemOverview = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Global System Overview</h1>
      <p className="text-slate-600">Super Admin holistic view of the BookBuddy SaaS infrastructure.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Globe size={24} />
            </div>
            <span className="text-success text-sm font-bold flex items-center">Active</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Total Registered Colleges</h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">14</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <Users size={24} />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Total Global Users</h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">128.4k</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Database size={24} />
            </div>
            <span className="text-success text-sm font-bold flex items-center">99.9% Uptime</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Database Load</h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">42%</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
              <Activity size={24} />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">API Requests (24h)</h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">1.2M</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">College Instance Health</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-900">
              <tr>
                <th className="p-3 font-semibold rounded-tl-lg">Tenant / College</th>
                <th className="p-3 font-semibold">Active Users</th>
                <th className="p-3 font-semibold">Storage Used</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold rounded-tr-lg">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-900">State University Central Library</td>
                <td className="p-3">45,210</td>
                <td className="p-3">120 GB</td>
                <td className="p-3"><span className="bg-success/10 text-success px-2 py-1 rounded text-xs font-bold">Healthy</span></td>
                <td className="p-3"><button className="text-indigo-600 hover:underline">View Details</button></td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-900">Tech Institute Branch</td>
                <td className="p-3">12,044</td>
                <td className="p-3">45 GB</td>
                <td className="p-3"><span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">High CPU Load</span></td>
                <td className="p-3"><button className="text-indigo-600 hover:underline">View Details</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemOverview;
