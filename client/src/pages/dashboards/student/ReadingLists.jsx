import { ListPlus, Bookmark } from 'lucide-react';

const ReadingLists = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Curated Reading Lists</h1>
          <p className="text-slate-600 mt-1">Discover collections put together by professors and librarians.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2">
          <ListPlus size={20} />
          Create My List
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Mock Reading List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-all group">
          <div className="h-40 bg-gradient-to-r from-indigo-500 to-purple-600 relative p-6 flex flex-col justify-end">
            <h3 className="text-white font-bold text-xl relative z-10">Data Structures 101</h3>
            <p className="text-indigo-100 text-sm relative z-10">By Prof. Alan Turing</p>
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
          </div>
          <div className="p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600">5 Books</span>
            <button className="text-slate-400 hover:text-indigo-600 transition-colors">
              <Bookmark size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReadingLists;
