import { Search, Filter } from 'lucide-react';

const GeneralSearch = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Advanced Catalog Search</h1>
          <p className="text-slate-600 mt-1">Search the entire library collection as a public user.</p>
        </div>
        <button className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 flex items-center justify-center gap-2">
          <Filter size={18} />
          Toggle Filters
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search by title, author, or ISBN..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-indigo-500 text-lg" />
          </div>
          <button type="button" className="bg-indigo-600 text-white font-medium px-8 py-3 rounded-lg hover:bg-indigo-700">
            Search
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {/* Mock Book */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
          <div className="h-48 bg-slate-200 w-full relative">
            <span className="absolute top-2 right-2 bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
              Reference
            </span>
          </div>
          <div className="p-4 flex-1 flex flex-col">
            <h3 className="font-bold text-slate-900 line-clamp-2 mb-1">Encyclopedia of Science</h3>
            <p className="text-sm text-slate-500 mb-4">Various Authors</p>
            <button className="mt-auto w-full border border-slate-200 text-slate-700 font-medium py-1.5 rounded hover:bg-slate-50">
              View Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralSearch;
