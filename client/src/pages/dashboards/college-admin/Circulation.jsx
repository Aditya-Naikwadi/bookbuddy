import { ScanLine, ArrowRightLeft, ListOrdered } from 'lucide-react';

const Circulation = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Circulation & Holds</h1>
      <p className="text-slate-600">Circulation desk controls and active reservation queue management.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Circulation Desk Controls */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <ArrowRightLeft className="text-indigo-600" />
            <h2 className="text-xl font-bold">Circulation Desk</h2>
          </div>
          
          <div className="flex gap-4 mb-6">
            <button className="flex-1 pb-2 border-b-2 border-indigo-600 font-bold text-indigo-700">Check Out</button>
            <button className="flex-1 pb-2 border-b-2 border-transparent text-slate-500 font-medium hover:text-slate-700">Check In</button>
          </div>
          
          <form className="space-y-4">
            <div className="relative">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Scan or enter Patron ID" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-lg font-mono focus:ring-indigo-500" />
            </div>
            <div className="relative">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Scan or enter Book Accession Number" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-lg font-mono focus:ring-indigo-500" />
            </div>
            <button type="button" className="w-full bg-slate-900 text-white font-medium py-3 rounded-lg hover:bg-slate-800 shadow-sm">
              Process Transaction
            </button>
          </form>
        </div>

        {/* Queue & Hold Management */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <ListOrdered className="text-indigo-600" />
            <h2 className="text-xl font-bold">Hold Queue Management</h2>
          </div>
          
          <div className="space-y-3">
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900">Clean Code</h4>
                <p className="text-sm text-slate-500 mt-1">Requested by: STU-1001</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">Position: 1</span>
                <button className="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100">Cancel</button>
              </div>
            </div>
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900">Introduction to Algorithms</h4>
                <p className="text-sm text-slate-500 mt-1">Requested by: FAC-2045</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-success/10 text-success text-xs font-bold px-2 py-1 rounded">Ready for Pickup</span>
                <button className="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100">Notify</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Circulation;
