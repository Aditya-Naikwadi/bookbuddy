import { useState } from 'react';
import { FileText, Download, ExternalLink, Loader2, BookOpen, Search } from 'lucide-react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../api/client';
import { searchEbooks, openEbook } from '../../../api/eresourcesApi';

const fetchInternalResources = async () => {
  const { data } = await apiClient.get('/dashboards/student/eresources');
  return data.data; // array
};

const EResources = () => {
  const [activeTab, setActiveTab] = useState('internal'); // 'internal' or 'ebooks'
  const [searchQuery, setSearchQuery] = useState('');
  const [topic, setTopic] = useState('');
  const navigate = useNavigate();

  // Internal resources query
  const { data: internalResources, isLoading: loadingInternal, error: errorInternal } = useQuery({
    queryKey: ['e-resources', 'internal'],
    queryFn: fetchInternalResources,
    enabled: activeTab === 'internal',
  });

  // Gutenberg infinite query
  const {
    data: ebookData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingEbooks,
    error: errorEbooks,
    refetch: refetchEbooks
  } = useInfiniteQuery({
    queryKey: ['e-resources', 'gutenberg', searchQuery, topic],
    queryFn: ({ pageParam = 1 }) => searchEbooks({ search: searchQuery, topic, page: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: activeTab === 'ebooks',
  });

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (activeTab === 'ebooks') {
      refetchEbooks();
    }
  };

  const handleReadExternal = async (gutenbergId) => {
    try {
      const { resourceId } = await openEbook(gutenbergId);
      navigate(`/eresources/read/${resourceId}`);
    } catch (error) {
      console.error('Failed to open ebook', error);
      alert('Failed to open this book. Please try again later.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Integrated E-Resources</h1>
          <p className="text-slate-600">Access journals, research papers, and 70k+ free e-books.</p>
        </div>
        
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-auto min-w-[300px]">
          <input
            type="text"
            placeholder="Search title, author, or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        </form>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-slate-200 pb-4">
        <button 
          onClick={() => setActiveTab('internal')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'internal' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Journals & Publications
        </button>
        <button 
          onClick={() => setActiveTab('ebooks')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'ebooks' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Gutenberg E-Books
        </button>
      </div>

      {/* Internal Resources */}
      {activeTab === 'internal' && (
        <>
          {loadingInternal && (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          )}

          {errorInternal && (
            <div className="bg-danger/10 text-danger p-4 rounded-lg">
              Failed to load internal e-resources. Please try again later.
            </div>
          )}

          {!loadingInternal && !errorInternal && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {internalResources?.length === 0 && <p className="text-slate-500">No resources found.</p>}
              
              {internalResources?.map((resource) => (
                <div key={resource._id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
                      <FileText size={24} />
                    </div>
                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full uppercase tracking-wider">
                      {resource.type || 'PDF'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mb-1">{resource.title}</h3>
                  <p className="text-sm text-slate-500 mb-4 flex-1">{resource.category}</p>
                  <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100">
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex-1 bg-indigo-50 text-indigo-700 font-medium py-2 rounded-lg hover:bg-indigo-100 flex justify-center items-center gap-2 transition-colors">
                      <ExternalLink size={16} /> Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Gutenberg E-Books */}
      {activeTab === 'ebooks' && (
        <>
          {/* Subject filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {['', 'fiction', 'history', 'science', 'philosophy'].map(t => (
              <button 
                key={t}
                onClick={() => setTopic(t)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  topic === t 
                    ? 'bg-slate-800 text-white border-slate-800' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {t === '' ? 'All Subjects' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {loadingEbooks && !ebookData ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : errorEbooks ? (
            <div className="bg-danger/10 text-danger p-4 rounded-lg">
              E-Resources catalog is temporarily unavailable. Please try again later.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ebookData?.pages[0]?.items?.length === 0 && (
                  <p className="text-slate-500 col-span-full">No books match — try a different search</p>
                )}
                
                {ebookData?.pages.map((page, i) => (
                  <div key={i} className="contents">
                    {page.items.map((book) => (
                      <div key={book.externalId} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col group hover:border-indigo-300 transition-colors">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-20 h-28 bg-slate-100 rounded shadow-sm overflow-hidden shrink-0">
                            {book.coverImage ? (
                              <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex justify-center items-center text-slate-300"><BookOpen /></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-lg mb-1 leading-tight line-clamp-2">{book.title}</h3>
                            <p className="text-sm text-slate-500 line-clamp-1">{book.author}</p>
                            <span className="inline-block mt-2 text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">
                              {book.language}
                            </span>
                          </div>
                        </div>
                        <div className="mt-auto pt-4 border-t border-slate-50">
                          <button 
                            onClick={() => handleReadExternal(book.externalId)}
                            className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800 flex justify-center items-center gap-2 transition-colors"
                          >
                            <BookOpen size={16} /> Read Book
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {hasNextPage && (
                <div className="flex justify-center pt-8">
                  <button 
                    onClick={() => fetchNextPage()} 
                    disabled={isFetchingNextPage}
                    className="px-6 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {isFetchingNextPage ? <><Loader2 className="animate-spin" size={16} /> Loading more...</> : 'Load More Books'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EResources;
