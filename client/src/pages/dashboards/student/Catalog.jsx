import { Bell, Filter, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../api/client';

const fetchCatalog = async () => {
  const { data } = await apiClient.get('/dashboards/student/catalog');
  return data.data; // assuming { success: true, data: [...] }
};

const Catalog = () => {
  const { data: books, isLoading, error } = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-serif font-bold text-slate-900">Catalog</h1>
        {/* Advanced Search Filters Toggle */}
        <button className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 flex items-center justify-center gap-2">
          <Filter size={18} />
          Advanced Filters
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      )}

      {error && (
        <div className="bg-danger/10 text-danger p-4 rounded-lg">
          Failed to load catalog. Please try again later.
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {books?.map((book) => (
            <div key={book._id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col relative group">
              <button className="absolute top-2 left-2 z-10 bg-white/90 p-1.5 rounded-full shadow-sm text-slate-400 hover:text-amber-500 transition-colors opacity-0 group-hover:opacity-100" title="Notify me when available">
                <Bell size={18} />
              </button>
              
              <div className="h-48 bg-slate-200 w-full relative">
                {book.coverImage && <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" />}
                <span className={`absolute top-2 right-2 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm ${book.availableCopies > 0 ? 'bg-success' : 'bg-danger'}`}>
                  {book.availableCopies > 0 ? `Available (${book.availableCopies})` : 'All Checked Out'}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-slate-900 line-clamp-2 mb-1">{book.title}</h3>
                <p className="text-sm text-slate-500 mb-4">{book.author}</p>
                {book.availableCopies > 0 ? (
                  <button className="mt-auto w-full border border-indigo-200 text-indigo-700 font-medium py-1.5 rounded hover:bg-indigo-50">
                    View Details
                  </button>
                ) : (
                  <button className="mt-auto w-full bg-slate-100 text-slate-600 font-medium py-1.5 rounded hover:bg-slate-200">
                    Join Queue
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Catalog;
