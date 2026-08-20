import React, { useState, useEffect } from 'react';
import {
  Share2,
  Search,
  Building2,
  BookOpen,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Send,
} from 'lucide-react';
import ShareRequestStatusTracker from '../components/ShareRequestStatusTracker';

export const CrossCollegeCatalog = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogItems, setCatalogItems] = useState({ books: [], eresources: [] });
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);
  const [requesting, setRequesting] = useState(false);

  const fetchCrossCollegeCatalog = async (query = '') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/catalog/cross-college?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCatalogItems(data.data || { books: [], eresources: [] });
      }
    } catch (err) {
      console.error('Error fetching cross-college catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/share-requests', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMyRequests(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching my share requests:', err);
    }
  };

  useEffect(() => {
    fetchCrossCollegeCatalog();
    fetchMyRequests();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCrossCollegeCatalog(searchQuery);
  };

  const handleConfirmRequest = async () => {
    if (!selectedResource) return;

    try {
      setRequesting(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/share-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resourceId: selectedResource._id,
          resourceType: selectedResource.type === 'pdf' || selectedResource.type === 'epub' ? 'eresource' : 'book',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedResource(null);
        await fetchMyRequests();
      } else {
        alert(data.message || 'Failed to submit share request.');
      }
    } catch (err) {
      console.error('Share request error:', err);
      alert('Network error submitting share request.');
    } finally {
      setRequesting(false);
    }
  };

  const allItems = [
    ...catalogItems.books.map((b) => ({ ...b, itemType: 'book' })),
    ...catalogItems.eresources.map((e) => ({ ...e, itemType: 'eresource' })),
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <Share2 className="w-3.5 h-3.5" /> Inter-Library Network Discovery
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          Cross-College Shared Catalog
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Explore and request physical books & e-resources opted into inter-library sharing by partner colleges.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="mb-8">
        <div className="relative max-w-2xl">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cross-college catalog by title, author, or category..."
            className="w-full pl-12 pr-28 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Results Grid */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" /> Shareable Collection ({allItems.length})
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 bg-slate-900/60 rounded-3xl animate-pulse"></div>
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800 p-6">
            <Share2 className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-white mb-1">No Shared Resources Found</h3>
            <p className="text-slate-400 text-xs">
              No partner college has opted in shareable items matching your search query.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allItems.map((item) => {
              const college = item.collegeId || {};
              const collegeName = college.name || 'Partner College';

              return (
                <div
                  key={item._id}
                  className="bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 shadow-lg group"
                >
                  <div>
                    {/* Owning College Badge */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-1.5 w-fit mb-3">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>From {collegeName}</span>
                    </div>

                    <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">By {item.author}</p>
                  </div>

                  {/* Request Button */}
                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                      {item.category || 'General'}
                    </span>

                    <button
                      onClick={() => setSelectedResource(item)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-md flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Request ILL</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {selectedResource && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedResource(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4">
              <Share2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              Request from {(selectedResource.collegeId || {}).name || 'Partner College'}?
            </h3>

            <p className="text-slate-400 text-xs mb-6">
              You are submitting an Inter-Library Loan request for <strong className="text-white">"{selectedResource.title}"</strong>. The owning college administrator will review your request.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedResource(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>

              <button
                disabled={requesting}
                onClick={handleConfirmRequest}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                {requesting ? 'Submitting...' : 'Confirm Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Active Share Requests & Status Trackers */}
      {myRequests.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" /> My Inter-Library Share Requests ({myRequests.length})
          </h2>

          <div className="space-y-4">
            {myRequests.map((reqItem) => (
              <div key={reqItem._id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-white">
                    Request from {(reqItem.owningCollegeId || {}).name || 'Partner College'}
                  </div>
                </div>

                <ShareRequestStatusTracker request={reqItem} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossCollegeCatalog;
