import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  Plus,
  Sparkles,
  Filter,
  Grid,
  List,
  Megaphone,
  Calendar as CalendarIcon,
  Tag,
  ChevronRight,
  UserCheck,
  AlertCircle,
  X,
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

export const Feed = () => {
  const { socket } = useSocket();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all', 'announcement', 'event'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [toastNotification, setToastNotification] = useState(null);
  const [rsvpLoadingId, setRsvpLoadingId] = useState(null);

  // Admin post modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postForm, setPostForm] = useState({
    type: 'announcement',
    title: '',
    body: '',
    eventDate: '',
    audience: ['student'],
    expiresAt: '',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Fetch initial feed posts from server
  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      const url = filterType === 'all' ? '/api/v1/feed' : `/api/v1/feed?type=${filterType}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPosts(data.data);
      }
    } catch (err) {
      console.error('Error fetching feed posts:', err);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Real-Time Socket.io Subscription: feed:new
  useEffect(() => {
    if (!socket) return;

    const handleNewPost = (newPost) => {
      if (!newPost || !newPost._id) return;

      setPosts((prevPosts) => {
        // Prevent duplicates
        if (prevPosts.some((p) => p._id === newPost._id)) {
          return prevPosts;
        }
        return [{ ...newPost, isNew: true }, ...prevPosts];
      });

      // Show live toast alert for new campus posts
      setToastNotification({
        title: newPost.type === 'event' ? '🎉 New Event Posted!' : '📢 Campus Announcement',
        message: newPost.title,
        id: newPost._id,
      });

      const timer = setTimeout(() => setToastNotification(null), 6000);
      return () => clearTimeout(timer);
    };

    socket.on('feed:new', handleNewPost);

    return () => {
      socket.off('feed:new', handleNewPost);
    };
  }, [socket]);

  // Handle RSVP Toggle
  const handleRsvp = async (postId) => {
    try {
      setRsvpLoadingId(postId);
      const res = await fetch(`/api/v1/feed/${postId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();

      if (data.success && data.data) {
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, rsvps: data.data.rsvps } : p))
        );
      }
    } catch (err) {
      console.error('Error toggling RSVP:', err);
    } finally {
      setRsvpLoadingId(null);
    }
  };

  // Handle Admin Post Submission
  const handleCreatePost = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSubmitting(true);

    try {
      const res = await fetch('/api/v1/feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(postForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create post');
      }

      setShowCreateModal(false);
      setPostForm({
        type: 'announcement',
        title: '',
        body: '',
        eventDate: '',
        audience: ['student'],
        expiresAt: '',
      });
      fetchFeed();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const getCurrentUserId = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        return u._id || u.id;
      }
    } catch {
      return null;
    }
    return null;
  };

  const currentUserId = getCurrentUserId();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Live Toast Banner */}
      {toastNotification && (
        <div className="fixed top-6 right-6 z-50 animate-bounce-in max-w-md w-full">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-2xl backdrop-blur-md border border-white/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Sparkles className="w-6 h-6 text-yellow-300 animate-spin" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                  Live Feed Update
                </span>
                <h4 className="font-bold text-sm leading-tight">{toastNotification.title}</h4>
                <p className="text-xs text-white/80 line-clamp-1">{toastNotification.message}</p>
              </div>
            </div>
            <button
              onClick={() => setToastNotification(null)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm mb-1">
              <Megaphone className="w-4 h-4" /> Campus Bulletin & Activity Hub
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Live College Feed
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Real-time announcements, campus events, and RSVP activity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List className="w-4 h-4" /> Feed List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CalendarIcon className="w-4 h-4" /> Calendar
              </button>
            </div>

            {/* Create Post Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all transform hover:scale-105"
            >
              <Plus className="w-4 h-4" /> Post Update
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 ml-2">
              <Filter className="w-3.5 h-3.5" /> Category:
            </span>
            {['all', 'announcement', 'event'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  filterType === type
                    ? 'bg-slate-800 text-indigo-400 border border-indigo-500/40 shadow-inner'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400 mr-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Real-Time Sync Active
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm font-medium">Syncing live campus feed...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/30 rounded-3xl border border-slate-800/60 p-8">
            <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-300">No Posts Available</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Check back soon for new announcements or events posted by college admins.
            </p>
          </div>
        ) : viewMode === 'calendar' ? (
          /* Calendar View for Events */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts
              .filter((p) => p.type === 'event' && p.eventDate)
              .map((post) => {
                const eventDt = new Date(post.eventDate);
                const isRsvped =
                  currentUserId &&
                  post.rsvps?.some((r) => r.userId && r.userId.toString() === currentUserId);

                return (
                  <div
                    key={post._id}
                    className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 flex gap-4 items-start hover:border-indigo-500/40 transition-all shadow-lg"
                  >
                    <div className="flex flex-col items-center justify-center bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 rounded-2xl p-3 min-w-[70px]">
                      <span className="text-xs font-bold uppercase">
                        {eventDt.toLocaleString('default', { month: 'short' })}
                      </span>
                      <span className="text-2xl font-black text-white">{eventDt.getDate()}</span>
                      <span className="text-[10px] text-slate-400">{eventDt.getFullYear()}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
                          Event
                        </span>
                        {post.isNew && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase animate-pulse">
                            New
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-base text-white truncate">{post.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">{post.body}</p>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{post.rsvps?.length || 0} Attending</span>
                        </div>

                        <button
                          onClick={() => handleRsvp(post._id)}
                          disabled={rsvpLoadingId === post._id}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isRsvped
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        >
                          {isRsvped ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" /> Going
                            </>
                          ) : (
                            'RSVP'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          /* Reverse-Chronological List View */
          <div className="space-y-4">
            {posts.map((post) => {
              const isEvent = post.type === 'event';
              const isRsvped =
                currentUserId &&
                post.rsvps?.some((r) => r.userId && r.userId.toString() === currentUserId);

              return (
                <div
                  key={post._id}
                  className={`relative overflow-hidden bg-slate-900/70 backdrop-blur-md rounded-3xl border transition-all duration-300 shadow-xl ${
                    post.isNew
                      ? 'border-emerald-500/50 shadow-emerald-500/10'
                      : 'border-slate-800 hover:border-slate-700'
                  } p-6`}
                >
                  {/* Glowing "New" Indicator */}
                  {post.isNew && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-emerald-500 text-slate-950 font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-bl-2xl shadow-md flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Live New
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${
                          isEvent
                            ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                            : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                        }`}
                      >
                        {isEvent ? (
                          <Calendar className="w-5 h-5" />
                        ) : (
                          <Megaphone className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              isEvent
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {post.type}
                          </span>

                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {new Date(post.createdAt || post.publishAt).toLocaleDateString(
                              undefined,
                              {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mt-1">{post.title}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <p className="text-slate-300 text-sm leading-relaxed mt-4 whitespace-pre-line">
                    {post.body}
                  </p>

                  {/* Event Details & RSVP Section */}
                  {isEvent && (
                    <div className="mt-5 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {post.eventDate && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                            <Calendar className="w-4 h-4 text-indigo-400" />
                            <span>{new Date(post.eventDate).toLocaleString()}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Users className="w-4 h-4 text-purple-400" />
                          <span>{post.rsvps?.length || 0} Attending</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRsvp(post._id)}
                        disabled={rsvpLoadingId === post._id}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-md ${
                          isRsvped
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white'
                        }`}
                      >
                        {rsvpLoadingId === post._id ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : isRsvped ? (
                          <>
                            <UserCheck className="w-4 h-4" /> Attending (Toggle Off)
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" /> RSVP Now
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Audience Badges */}
                  {Array.isArray(post.audience) && post.audience.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500">
                      <Tag className="w-3 h-3 text-slate-600" /> Audience:
                      {post.audience.map((aud) => (
                        <span
                          key={aud}
                          className="px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 font-medium"
                        >
                          {aud}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Post Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-indigo-400" /> Post Campus Update
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {createError}
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Post Type
                </label>
                <select
                  value={postForm.type}
                  onChange={(e) => setPostForm({ ...postForm, type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="announcement">Announcement</option>
                  <option value="event">Event</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Midterm Examination Schedule"
                  value={postForm.title}
                  onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 font-sans">
                  Body Content
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write update details..."
                  value={postForm.body}
                  onChange={(e) => setPostForm({ ...postForm, body: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              {postForm.type === 'event' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Event Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={postForm.eventDate}
                    onChange={(e) => setPostForm({ ...postForm, eventDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-2"
                >
                  {createSubmitting && (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  )}
                  Publish Live Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feed;
