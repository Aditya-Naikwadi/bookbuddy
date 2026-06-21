import { Shield, UserPlus, Mail } from 'lucide-react';

const CollegeAdminManager = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">College Admin Management</h1>
      <p className="text-slate-600">Provision and manage access for regional College Admin accounts.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Provision New Admin */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="text-indigo-600" />
            <h2 className="text-xl font-bold">Provision Admin</h2>
          </div>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input type="email" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assigned College / Branch</label>
              <select className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                <option>State University Central Library</option>
                <option>Tech Institute Branch</option>
                <option>Medical Campus Library</option>
              </select>
            </div>
            <button type="button" className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 mt-2">
              <Mail size={16} /> Send Invitation Link
            </button>
          </form>
        </div>

        {/* Admin Directory */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="text-indigo-600" />
              <h2 className="text-xl font-bold">Admin Directory</h2>
            </div>
            <input type="text" placeholder="Search admins..." className="p-2 border border-slate-300 rounded-lg text-sm w-64" />
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-900">
                <tr>
                  <th className="p-3 font-semibold rounded-tl-lg">Admin Name</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold">Assigned Branch</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold rounded-tr-lg">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">Sarah Jenkins</td>
                  <td className="p-3">sarah.j@stateuniv.edu</td>
                  <td className="p-3">State University Central</td>
                  <td className="p-3"><span className="bg-success/10 text-success px-2 py-1 rounded text-xs font-bold">Active</span></td>
                  <td className="p-3">
                    <button className="text-indigo-600 hover:underline mr-3">Edit</button>
                    <button className="text-danger hover:underline">Revoke</button>
                  </td>
                </tr>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">Marcus Thorne</td>
                  <td className="p-3">m.thorne@techinst.edu</td>
                  <td className="p-3">Tech Institute Branch</td>
                  <td className="p-3"><span className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold">Pending Invite</span></td>
                  <td className="p-3">
                    <button className="text-indigo-600 hover:underline mr-3">Resend</button>
                    <button className="text-danger hover:underline">Revoke</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollegeAdminManager;
