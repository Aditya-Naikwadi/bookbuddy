import { useState } from "react";
import {
  FileText,
  Loader2,
  BookOpen,
  Search,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
} from "lucide-react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import apiClient from "../../../api/client";
import { searchEbooks, openEbook } from "../../../api/eresourcesApi";

const fetchInternalResources = async () => {
  const { data } = await apiClient.get("/dashboards/student/eresources");
  return data.data || [];
};

const fetchMySubmissions = async () => {
  try {
    const { data } = await apiClient.get(
      "/dashboards/student/eresources/my-submissions",
    );
    return data.data || [];
  } catch {
    return [];
  }
};

export const EResources = () => {
  const [activeTab, setActiveTab] = useState("internal"); // 'internal' | 'ebooks' | 'my-submissions'
  const [searchQuery, setSearchQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Upload Form Fields
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Computer Science");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const navigate = useNavigate();

  // Internal resources query
  const {
    data: internalResources,
    isLoading: loadingInternal,
    error: errorInternal,
  } = useQuery({
    queryKey: ["e-resources", "internal"],
    queryFn: fetchInternalResources,
    enabled: activeTab === "internal",
  });

  // Student's own submissions query
  const {
    data: mySubmissions = [],
    isLoading: loadingSubmissions,
    refetch: refetchSubmissions,
  } = useQuery({
    queryKey: ["e-resources", "my-submissions"],
    queryFn: fetchMySubmissions,
    enabled: activeTab === "my-submissions",
  });

  // Gutenberg infinite query
  const {
    data: ebookData,
    isLoading: loadingEbooks,
    refetch: refetchEbooks,
  } = useInfiniteQuery({
    queryKey: ["e-resources", "gutenberg", searchQuery, topic],
    queryFn: ({ pageParam = 1 }) =>
      searchEbooks({ search: searchQuery, topic, page: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: activeTab === "ebooks",
  });

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (activeTab === "ebooks") {
      refetchEbooks();
    }
  };

  const handleReadExternal = async (gutenbergId) => {
    try {
      const { resourceId } = await openEbook(gutenbergId);
      navigate(`/eresources/read/${resourceId}`);
    } catch (error) {
      console.error("Failed to open ebook", error);
      alert("Failed to open this book. Please try again later.");
    }
  };

  // Submit student uploaded material to moderation
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadTitle || !selectedFile) {
      setUploadMessage("Please provide a title and select a file.");
      return;
    }

    setIsSubmitting(true);
    setUploadMessage("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", uploadTitle);
      formData.append("category", uploadCategory);
      formData.append("description", uploadDescription);

      await apiClient.post("/dashboards/student/eresources", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadMessage(
        "Material submitted successfully! It is now pending staff moderation.",
      );
      setTimeout(() => {
        setUploadModalOpen(false);
        setUploadTitle("");
        setUploadDescription("");
        setSelectedFile(null);
        setUploadMessage("");
        setActiveTab("my-submissions");
        refetchSubmissions();
      }, 1500);
    } catch (err) {
      setUploadMessage(
        err?.response?.data?.message || "Failed to submit material.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">
            Integrated E-Resources
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Access academic journals, textbooks, research papers, and open
            e-books.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus size={16} />
            <span>Upload Material</span>
          </button>

          {/* Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex-1 md:w-64"
          >
            <input
              type="text"
              placeholder="Search title, author, or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
          </form>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("internal")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "internal"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
          }`}
        >
          Journals & Academic Papers
        </button>
        <button
          onClick={() => setActiveTab("ebooks")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "ebooks"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
          }`}
        >
          Gutenberg Open E-Books
        </button>
        <button
          onClick={() => setActiveTab("my-submissions")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "my-submissions"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
          }`}
        >
          <Upload size={14} />
          <span>My Submissions ({mySubmissions.length})</span>
        </button>
      </div>

      {/* Internal Resources */}
      {activeTab === "internal" && (
        <>
          {loadingInternal && (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          )}

          {errorInternal && (
            <div className="bg-red-500/10 text-red-600 p-4 rounded-2xl text-xs font-bold">
              Failed to load internal e-resources. Please try again later.
            </div>
          )}

          {!loadingInternal && !errorInternal && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {internalResources?.length === 0 && (
                <p className="text-slate-400 text-xs">No resources found.</p>
              )}

              {internalResources?.map((resource) => (
                <div
                  key={resource._id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="bg-indigo-50 dark:bg-indigo-950/50 p-3 rounded-2xl text-indigo-600">
                        <FileText size={24} />
                      </div>
                      <span className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {resource.type || "PDF"}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                      {resource.title}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      {resource.category}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() =>
                        navigate(`/eresources/read/${resource._id}`)
                      }
                      className="w-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold py-2.5 rounded-xl hover:bg-indigo-100 transition-colors flex justify-center items-center gap-2 text-xs"
                    >
                      <BookOpen size={16} /> Read Online
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Student My Submissions Tab */}
      {activeTab === "my-submissions" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Track the moderation status of study materials you've uploaded.
          </p>

          {loadingSubmissions ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              Loading your submissions...
            </div>
          ) : mySubmissions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-3">
              <Upload
                size={36}
                className="mx-auto text-slate-300 dark:text-slate-700"
              />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                No submissions uploaded yet
              </p>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
              >
                Submit First Material
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {mySubmissions.map((sub) => {
                const isApproved =
                  sub.moderationStatus === "approved" ||
                  sub.moderationStatus === "published";
                const isRejected = sub.moderationStatus === "rejected";

                return (
                  <div
                    key={sub._id}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          {sub.title}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Category: {sub.category} • Submitted recently
                        </p>
                        {sub.moderationFeedback && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 italic">
                            Feedback: "{sub.moderationFeedback}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          isApproved
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : isRejected
                              ? "bg-red-500/10 text-red-600 border border-red-500/20"
                              : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        }`}
                      >
                        {isApproved ? (
                          <CheckCircle2 size={14} />
                        ) : isRejected ? (
                          <XCircle size={14} />
                        ) : (
                          <Clock size={14} />
                        )}
                        {sub.moderationStatus || "pending"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Gutenberg E-Books */}
      {activeTab === "ebooks" && (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {["", "fiction", "history", "science", "philosophy"].map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                  topic === t
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                }`}
              >
                {t === ""
                  ? "All Subjects"
                  : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {loadingEbooks && !ebookData ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ebookData?.pages.map((page, i) => (
                <div key={i} className="contents">
                  {page.items.map((book) => (
                    <div
                      key={book.externalId}
                      className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-24 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shrink-0 shadow-sm">
                          {book.coverImage ? (
                            <img
                              src={book.coverImage}
                              alt={book.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex justify-center items-center text-slate-400">
                              <BookOpen size={20} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1 line-clamp-2">
                            {book.title}
                          </h3>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {book.author}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReadExternal(book.externalId)}
                        className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-2.5 rounded-xl text-xs flex justify-center items-center gap-2"
                      >
                        <BookOpen size={14} /> Read Book
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Upload Material Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Upload size={18} className="text-indigo-600" />
                Submit Study Material for Moderation
              </h3>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {uploadMessage && (
              <p
                className={`text-xs p-3 rounded-xl font-bold ${
                  uploadMessage.includes("successfully")
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-600 border border-red-500/20"
                }`}
              >
                {uploadMessage}
              </p>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures Reference Manual"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                  Subject / Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Computer Science">Computer Science</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="General Academic">General Academic</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of document content..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                  Document File (PDF / EPUB) *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.epub"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="flex-1 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow"
                >
                  {isSubmitting ? "Uploading..." : "Submit Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EResources;
