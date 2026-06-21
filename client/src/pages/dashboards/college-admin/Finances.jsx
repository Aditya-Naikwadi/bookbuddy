import { Settings2, IndianRupee, CreditCard } from 'lucide-react';

const Finances = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Finances & Ledgers</h1>
      <p className="text-slate-600">Configure dynamic fine rules and manage payment gateways.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dynamic Fine Rules Engine */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Settings2 className="text-indigo-600" />
              <h2 className="text-xl font-bold">Dynamic Fine Rules Engine</h2>
            </div>
          </div>
          
          <form className="space-y-5">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
              <h3 className="font-bold text-slate-800 mb-3">General Collection</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Grace Period (Days)</label>
                  <input type="number" defaultValue={2} className="w-full p-2 border border-slate-300 rounded" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Fine per Day (₹)</label>
                  <input type="number" defaultValue={5} className="w-full p-2 border border-slate-300 rounded" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
              <h3 className="font-bold text-slate-800 mb-3">Course Reserves (High Demand)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Grace Period (Hours)</label>
                  <input type="number" defaultValue={0} className="w-full p-2 border border-slate-300 rounded" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Fine per Hour (₹)</label>
                  <input type="number" defaultValue={10} className="w-full p-2 border border-slate-300 rounded" />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input type="checkbox" id="capFines" defaultChecked className="w-4 h-4 text-indigo-600" />
              <label htmlFor="capFines" className="text-sm text-slate-700">Cap max fines at replacement cost of book</label>
            </div>

            <button type="button" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800">
              Save Rule Overrides
            </button>
          </form>
        </div>

        {/* Ledger & Payment Gateway */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="text-indigo-600" />
              <h2 className="text-xl font-bold">Ledger Overview</h2>
            </div>
            <button className="text-sm font-medium text-indigo-600 border border-indigo-200 px-3 py-1 rounded hover:bg-indigo-50">Export</button>
          </div>
          
          <div className="mb-6">
            <p className="text-sm text-slate-500">Collected this month</p>
            <p className="text-4xl font-bold text-slate-900">₹14,250</p>
          </div>

          <h3 className="font-bold text-sm mb-3">Recent Transactions</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-slate-50 text-sm">
              <div className="flex items-center gap-3">
                <div className="bg-success/10 p-2 rounded-full text-success"><CreditCard size={16} /></div>
                <div>
                  <p className="font-bold text-slate-900">STU-1042</p>
                  <p className="text-xs text-slate-500">Online Payment Gateway</p>
                </div>
              </div>
              <span className="font-bold text-success">+₹45.00</span>
            </div>
            <div className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-slate-50 text-sm">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-full text-indigo-600"><IndianRupee size={16} /></div>
                <div>
                  <p className="font-bold text-slate-900">STU-0991</p>
                  <p className="text-xs text-slate-500">Cash at Circulation Desk</p>
                </div>
              </div>
              <span className="font-bold text-success">+₹15.00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Finances;
