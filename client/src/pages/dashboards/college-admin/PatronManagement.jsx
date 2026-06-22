import { Users, UserPlus, KeyRound } from 'lucide-react';

const PatronManagement = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Patron Management</h1>
      <p className="text-slate-600">Create credentials and manage the comprehensive patron database.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Create Student ID */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="text-indigo-600" />
            <h2 className="text-xl font-bold">New Patron Credential</h2>
          </div>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select className="w-full p-2 border border-slate-300 rounded-lg">
                <option>Student</option>
                <option>Faculty</option>
                <option>Staff</option>
              </select>
            </div>
            <button type="button" className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 flex justify-center items-center gap-2">
              <KeyRound size={18} />
              Generate ID & Password
            </button>
          </form>
        </div>

        {/* Comprehensive Patron Database */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="text-indigo-600" />
              <h2 className="text-xl font-bold">Patron Database</h2>
            </div>
            <input type="text" placeholder="Search by ID or Name..." className="p-2 border border-slate-300 rounded-lg text-sm w-64" />
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-900">
                <tr>
                  <th className="p-3 font-semibold rounded-tl-lg">ID</th>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Role</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold rounded-tr-lg">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-mono">STU-1001</td>
                  <td className="p-3 font-medium text-slate-900">John Doe</td>
                  <td className="p-3">Student</td>
                  <td className="p-3"><span className="bg-success/10 text-success px-2 py-1 rounded text-xs font-bold">Active</span></td>
                  <td className="p-3"><button className="text-indigo-600 hover:underline">Edit</button></td>
                </tr>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-mono">FAC-2045</td>
                  <td className="p-3 font-medium text-slate-900">Dr. Alan Turing</td>
                  <td className="p-3">Faculty</td>
                  <td className="p-3"><span className="bg-success/10 text-success px-2 py-1 rounded text-xs font-bold">Active</span></td>
                  <td className="p-3"><button className="text-indigo-600 hover:underline">Edit</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatronManagement;
