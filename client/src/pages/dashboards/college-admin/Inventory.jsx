import { PackageSearch, AlertTriangle, CheckCircle } from 'lucide-react';

const Inventory = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Inventory & Stock Auditing</h1>
      <p className="text-slate-600">Real-time tracking of physical assets and missing items reconciliation.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm text-slate-500 font-medium">Total Books</h2>
          <p className="text-2xl font-bold mt-1">14,500</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm text-slate-500 font-medium">Currently Loaned</h2>
          <p className="text-2xl font-bold mt-1 text-indigo-600">3,240</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500">
          <h2 className="text-sm text-slate-500 font-medium">Marked Missing</h2>
          <p className="text-2xl font-bold mt-1 text-amber-600">42</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-danger">
          <h2 className="text-sm text-slate-500 font-medium">Needs Repair</h2>
          <p className="text-2xl font-bold mt-1 text-danger">18</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PackageSearch className="text-indigo-600" />
            <h2 className="text-xl font-bold">Stock Auditing Scanner</h2>
          </div>
        </div>
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-6">
          <p className="text-sm text-slate-600 mb-4">Select a section and scan barcodes rapidly to verify physical presence.</p>
          <div className="flex gap-4">
            <select className="w-1/3 p-3 border border-slate-300 rounded-lg bg-white">
              <option>Section A (Computer Science)</option>
              <option>Section B (Mathematics)</option>
              <option>Section C (Physics)</option>
            </select>
            <input type="text" placeholder="Scan Barcode (e.g. BKB-10294)" className="flex-1 p-3 border border-slate-300 rounded-lg font-mono focus:ring-indigo-500 bg-white" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-bold text-slate-900">Recent Scans</h3>
          <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
            <div>
              <span className="font-mono text-sm font-bold text-success-800">BKB-10294</span>
              <span className="ml-3 text-sm text-slate-700">Design Patterns</span>
            </div>
            <CheckCircle className="text-success w-5 h-5" />
          </div>
          <div className="flex items-center justify-between p-3 bg-danger/10 border border-danger/20 rounded-lg">
            <div>
              <span className="font-mono text-sm font-bold text-danger-800">BKB-10295</span>
              <span className="ml-3 text-sm text-slate-700">Unknown Barcode / Not in System</span>
            </div>
            <AlertTriangle className="text-danger w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
