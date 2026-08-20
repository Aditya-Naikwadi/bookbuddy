import React, { useState, useEffect } from 'react';
import { Trophy, Flame, BookOpen, Eye, EyeOff, Shield, Sparkles, RefreshCw } from 'lucide-react';
import apiClient from '../api/client';

export const Leaderboard = () => {
  const [metric, setMetric] = useState('points');
  const [leaderboard, setLeaderboard] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  const fetchUser = async () => {
    try {
      const res = await apiClient.get('/users/me');
      if (res.data?.data) {
        setUser(res.data.data);
      }
    } catch (err) {
      console.warn('Could not fetch user profile:', err);
    }
  };

  const fetchLeaderboard = async (selectedMetric = metric) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/leaderboard?metric=${selectedMetric}`);
      if (res.data?.data) {
        setLeaderboard(res.data.data);
      } else if (Array.isArray(res.data)) {
        setLeaderboard(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    fetchLeaderboard(metric);
  }, [metric]);

  const handleToggleVisibility = async () => {
    if (!user) return;
    const newVisibility = !user.isLeaderboardVisible;
    setTogglingVisibility(true);

    try {
      const res = await apiClient.patch('/users/me', {
        isLeaderboardVisible: newVisibility,
      });

      setUser((prev) => ({
        ...prev,
        isLeaderboardVisible: newVisibility,
        ...(res.data?.data || {}),
      }));

      // Immediately re-fetch leaderboard to reflect updated visibility
      await fetchLeaderboard(metric);
    } catch (err) {
      console.error('Failed to update leaderboard visibility:', err);
    } finally {
      setTogglingVisibility(false);
    }
  };

  const metricTabs = [
    { id: 'points', label: 'Points Leaderboard', icon: Trophy },
    { id: 'streak', label: 'Daily Streak', icon: Flame },
    { id: 'pages', label: 'Pages Read', icon: BookOpen },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-amber-300">
            <Sparkles className="w-4 h-4" /> Patron Leaderboard & Ranking
          </div>
          <h1 className="text-3xl font-bold mt-1">Campus Reading Leaderboard</h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Compete, earn points, and celebrate reading achievements across the campus community.
          </p>
        </div>

        {/* Opt-in Visibility Toggle */}
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center justify-between gap-4 w-full md:w-auto">
          <div>
            <p className="text-xs text-amber-200 font-medium">Leaderboard Visibility</p>
            <p className="text-sm font-semibold flex items-center gap-1.5 mt-0.5">
              {user?.isLeaderboardVisible !== false ? (
                <>
                  <Eye className="w-4 h-4 text-emerald-400" /> Visible
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-rose-400" /> Hidden (Opted Out)
                </>
              )}
            </p>
          </div>
          <button
            onClick={handleToggleVisibility}
            disabled={togglingVisibility}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
              user?.isLeaderboardVisible !== false
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {togglingVisibility
              ? 'Saving...'
              : user?.isLeaderboardVisible !== false
              ? 'Hide Me'
              : 'Show Me'}
          </button>
        </div>
      </div>

      {/* Metric Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {metricTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = metric === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMetric(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => fetchLeaderboard(metric)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Leaderboard Table / Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <Trophy className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-lg">No entries on the leaderboard yet.</p>
            <p className="text-xs mt-1">Be the first to earn points and climb the ranks!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {leaderboard.map((entry, idx) => {
              const rank = entry.rank || idx + 1;
              const isTop3 = rank <= 3;
              const rankBadges = {
                1: '🥇',
                2: '🥈',
                3: '🥉',
              };

              return (
                <div
                  key={entry.userId || idx}
                  className={`p-4 sm:p-5 flex items-center justify-between transition-colors ${
                    entry.isSelf
                      ? 'bg-amber-500/10 dark:bg-amber-500/15 font-medium border-l-4 border-l-amber-500'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 text-center font-bold text-lg text-slate-700 dark:text-slate-300">
                      {rankBadges[rank] || `#${rank}`}
                    </div>

                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-sm shadow">
                      {entry.displayName ? entry.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">
                          {entry.displayName}
                        </h4>
                        {entry.isSelf && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500 text-slate-950">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {entry.department || 'Library Patron'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white block">
                      {entry.score}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      {entry.unit || metric}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
