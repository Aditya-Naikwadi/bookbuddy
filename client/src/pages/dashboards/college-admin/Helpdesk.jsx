import { Ticket, Search, CheckCircle } from 'lucide-react';

const Helpdesk = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Ticketing & Helpdesk</h1>
      <p className="text-slate-600">Resolve patron issues, system complaints, and acquisition requests.</p>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Ticket className="text-indigo-600" />
            <h2 className="text-xl font-bold">Active Support Tickets</h2>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type="text" placeholder="Search tickets..." className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-full md:w-64" />
            </div>
            <select className="p-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option>All Statuses</option>
              <option>Open</option>
              <option>In Progress</option>
              <option>Resolved</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-900">
              <tr>
                <th className="p-3 font-semibold rounded-tl-lg">Ticket ID</th>
                <th className="p-3 font-semibold">Subject / Issue</th>
                <th className="p-3 font-semibold">Reported By</th>
                <th className="p-3 font-semibold">Category</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold rounded-tr-lg">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-mono font-medium text-slate-900">#TK-9021</td>
                <td className="p-3 text-slate-900">Acquisition: "Clean Architecture"</td>
                <td className="p-3">STU-1001</td>
                <td className="p-3">Book Request</td>
                <td className="p-3"><span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">Open</span></td>
                <td className="p-3"><button className="text-indigo-600 hover:underline font-medium">Review</button></td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-mono font-medium text-slate-900">#TK-9018</td>
                <td className="p-3 text-slate-900">Terminal 4 Keyboard broken</td>
                <td className="p-3">FAC-2045</td>
                <td className="p-3">Facility Issue</td>
                <td className="p-3"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">In Progress</span></td>
                <td className="p-3"><button className="text-indigo-600 hover:underline font-medium">Update</button></td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-mono font-medium text-slate-900">#TK-8990</td>
                <td className="p-3 text-slate-900">Login issue on student portal</td>
                <td className="p-3">STU-0982</td>
                <td className="p-3">Digital Portal</td>
                <td className="p-3"><span className="bg-success/10 text-success px-2 py-1 rounded text-xs font-bold flex items-center w-fit gap-1"><CheckCircle size={12} /> Resolved</span></td>
                <td className="p-3"><button className="text-slate-500 hover:underline font-medium">View</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Helpdesk;
