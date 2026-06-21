import { BookPlus, LibraryBig } from 'lucide-react';

const Cataloging = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Cataloging & Course Reserves</h1>
      <p className="text-slate-600">Global catalog management and professor course reserves.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Global Cataloging */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <BookPlus className="text-indigo-600" />
            <h2 className="text-xl font-bold">Add New Title</h2>
          </div>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">ISBN</label>
                <div className="flex gap-2">
                  <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500" />
                  <button type="button" className="bg-slate-100 px-4 rounded-lg font-medium text-slate-600 hover:bg-slate-200 whitespace-nowrap">Auto-Fill</button>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Author</label>
                <input type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Copies</label>
                <input type="number" defaultValue={1} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500" />
              </div>
            </div>
            <button type="button" className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 mt-2">
              Save to Catalog
            </button>
          </form>
        </div>

        {/* Course Reserve Management */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <LibraryBig className="text-indigo-600" />
            <h2 className="text-xl font-bold">Course Reserves</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">Restrict circulation rules for textbooks requested by professors.</p>
          
          <form className="space-y-4 border-b border-slate-100 pb-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Course Code</label>
              <input type="text" placeholder="e.g. CS101" className="w-full p-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Book Accession</label>
              <input type="text" placeholder="Scan barcode..." className="w-full p-2 border border-slate-300 rounded-lg" />
            </div>
            <button type="button" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800">
              Add to Reserve
            </button>
          </form>

          <div>
            <h3 className="font-bold text-sm mb-3 text-slate-700">Active Reserves</h3>
            <ul className="space-y-2">
              <li className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex justify-between text-sm">
                <span><strong className="text-slate-900">CS101:</strong> Intro to Algorithms</span>
                <span className="text-danger font-medium text-xs bg-danger/10 px-2 py-0.5 rounded">2-Hour Loan</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cataloging;
