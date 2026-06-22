import { Bookmark } from 'lucide-react';

const SavedBookmarks = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Saved & Bookmarks</h1>
      
      <div className="flex gap-4 border-b border-slate-200">
        <button className="pb-3 border-b-2 border-indigo-600 font-medium text-indigo-600 px-2">Bookmarked Books</button>
        <button className="pb-3 text-slate-500 hover:text-slate-700 font-medium px-2">Saved Searches</button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 pt-4">
        {/* Mock Bookmarked Book */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
          <button className="absolute top-2 right-2 z-10 bg-white p-1.5 rounded-full shadow-sm text-indigo-600 hover:text-indigo-800 transition-colors">
            <Bookmark size={18} fill="currentColor" />
          </button>
          <div className="h-48 bg-slate-200 w-full"></div>
          <div className="p-4">
            <h3 className="font-bold text-slate-900 line-clamp-2 mb-1">Introduction to Algorithms</h3>
            <p className="text-sm text-slate-500">Thomas H. Cormen</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SavedBookmarks;
