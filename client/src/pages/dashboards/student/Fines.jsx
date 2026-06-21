import { Receipt, AlertCircle, Calendar } from 'lucide-react';

const Fines = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Fines & Dues</h1>
      <p className="text-slate-600">Transparent tracking of all your library dues.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="text-indigo-600" />
              Itemized Fines
            </h2>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
              Pay Balance
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-900">
                <tr>
                  <th className="p-3 font-semibold rounded-tl-lg">Item</th>
                  <th className="p-3 font-semibold">Calculation</th>
                  <th className="p-3 font-semibold">Amount</th>
                  <th className="p-3 font-semibold rounded-tr-lg">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="p-4 font-medium text-slate-900">Introduction to Algorithms</td>
                  <td className="p-4 text-xs">₹5/day × 3 days late</td>
                  <td className="p-4 font-bold text-danger">₹15.00</td>
                  <td className="p-4"><span className="bg-danger/10 text-danger px-2 py-1 rounded text-xs font-bold uppercase">Unpaid</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
          <h2 className="text-xl font-bold mb-4">Total Balance</h2>
          <div className="text-5xl font-bold text-slate-900 mb-6">₹15.00</div>
          
          <div className="border-t border-slate-100 pt-4 mt-2">
            <h3 className="font-bold flex items-center gap-2 mb-3">
              <AlertCircle size={18} className="text-amber-500" />
              Automated Reminders
            </h3>
            <div className="flex items-start gap-3 bg-amber-50 p-3 rounded-lg border border-amber-100 text-sm">
              <Calendar size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800">Your reminder preferences are set to email you <strong>2 days</strong> before an item is due.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Fines;
