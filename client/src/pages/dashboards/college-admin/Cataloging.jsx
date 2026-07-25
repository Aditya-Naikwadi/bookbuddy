import { useState } from 'react';
import { BookPlus, LibraryBig, RefreshCw, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import useAuthStore from '../../../store/authStore';
import { useBookSearch } from '../../../hooks/useBookData';
import BookDataState from '../../../components/common/BookDataState';
import BookCoverImage from '../../../components/common/BookCoverImage';
import apiClient from '../../../api/client';

const Cataloging = () => {
  const { user } = useAuthStore();
  const collegeId = user?.collegeId || null;

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    category: 'Computer Science',
    copiesTotal: 1,
    shelfLocation: 'Main Stacks',
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Shared Data Layer Hook for Catalog Management
  const {
    data: catalogData,
    isLoading,
    isError,
    error,
    refetch,
  } = useBookSearch(collegeId, { limit: 20 });

  const books = catalogData?.books || [];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.author || !formData.isbn) {
      setFeedback({ type: 'error', text: 'Title, Author, and ISBN are required.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);
      const targetCollege = collegeId || user?.collegeId;
      await apiClient.post(`/college/${targetCollege}/books`, {
        ...formData,
        copiesTotal: Number(formData.copiesTotal),
        copiesAvailable: Number(formData.copiesTotal),
      });

      setFeedback({ type: 'success', text: 'Book title added to catalog successfully!' });
      setFormData({
        title: '',
        author: '',
        isbn: '',
        category: 'Computer Science',
        copiesTotal: 1,
        shelfLocation: 'Main Stacks',
      });
      refetch();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save book to catalog.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Cataloging & Catalog Management</h1>
          <p className="text-slate-600 text-xs mt-1">
            Manage your college collection, add new physical/digital volumes, and configure course reserves.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all text-xs font-bold flex items-center gap-1.5 shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Catalog</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form to Add Title */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BookPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Add New Title</h2>
              <p className="text-xs text-slate-500">Insert physical volume into college inventory</p>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g. Introduction to Algorithms"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Author *</label>
              <input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                placeholder="e.g. Thomas H. Cormen"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">ISBN *</label>
                <input
                  type="text"
                  name="isbn"
                  value={formData.isbn}
                  onChange={handleInputChange}
                  placeholder="978-0262033848"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none font-medium"
                >
                  <option value="Computer Science">Computer Science</option>
                  <option value="Physics">Physics</option>
                  <option value="Architecture">Architecture</option>
                  <option value="Economics">Economics</option>
                  <option value="Literature">Literature</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Total Copies</label>
                <input
                  type="number"
                  name="copiesTotal"
                  min={1}
                  value={formData.copiesTotal}
                  onChange={handleInputChange}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Shelf Location</label>
                <input
                  type="text"
                  name="shelfLocation"
                  value={formData.shelfLocation}
                  onChange={handleInputChange}
                  placeholder="e.g. CS-STACK-04"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {submitting ? 'Saving to Catalog...' : 'Save to Catalog'}
            </button>
          </form>
        </div>

        {/* Right Column: Live Catalog Collection Table */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <LibraryBig className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">College Catalog Records ({books.length})</h2>
                  <p className="text-xs text-slate-500">Live view of current library inventory</p>
                </div>
              </div>
            </div>

            <BookDataState
              isLoading={isLoading}
              isError={isError}
              error={error}
              onRetry={refetch}
              isEmpty={books.length === 0}
            >
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {books.map((book) => (
                  <div
                    key={book._id || book.id}
                    className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3 hover:border-indigo-200 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-14 flex-shrink-0">
                        <BookCoverImage
                          src={book.coverUrl}
                          fallbackTitle={book.title}
                          fallbackCategory={book.category}
                          aspectRatio="h-14"
                        />
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-xs truncate">{book.title}</h4>
                        <p className="text-[11px] text-slate-500 truncate">By {book.author}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium">
                          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                            {book.category}
                          </span>
                          <span>ISBN: {book.isbn}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full block mb-1 ${
                          book.availableCopies > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {book.availableCopies} / {book.totalCopies} Available
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {book.shelfLocation || 'Main Stacks'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </BookDataState>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cataloging;
