import { useState, useEffect } from 'react';
import { Award, Lock, Sparkles, User as UserIcon, CheckCircle, Eye, EyeOff } from 'lucide-react';
import apiClient from '../api/client';

export const Profile = () => {
  const [user, setUser] = useState(null);
  const [allBadges, setAllBadges] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  useEffect(() => {
    const fetchProfileData = async () => {
      setLoading(true);
      try {
        const [userRes, badgesRes, earnedRes] = await Promise.all([
          apiClient.get('/users/me').catch(() => ({ data: { data: null } })),
          apiClient.get('/badges').catch(() => ({ data: { data: [] } })),
          apiClient.get('/badges/me').catch(() => ({ data: { data: [] } })),
        ]);

        if (userRes.data?.data) {
          setUser(userRes.data.data);
        }
        if (badgesRes.data?.data) {
          setAllBadges(badgesRes.data.data);
        }
        if (earnedRes.data?.data) {
          setEarnedBadges(earnedRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  const handleToggleVisibility = async () => {
    if (!user) return;
    const newVisibility = !user.isLeaderboardVisible;
    setUpdatingVisibility(true);

    try {
      const res = await apiClient.patch('/users/me', {
        isLeaderboardVisible: newVisibility,
      });
      setUser((prev) => ({
        ...prev,
        isLeaderboardVisible: newVisibility,
        ...(res.data?.data || {}),
      }));
    } catch (err) {
      console.error('Failed to update leaderboard visibility:', err);
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const earnedKeysSet = new Set(earnedBadges.map((b) => b.badgeKey || b.key));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* User Header Profile Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-0" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-3xl font-bold shadow-lg border-2 border-white/20">
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-10 h-10" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{user?.name || 'Library Patron'}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 uppercase">
                  {user?.role || 'Student'}
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">{user?.email}</p>
              <div className="flex items-center gap-4 mt-3 text-xs sm:text-sm text-slate-300">
                <span className="flex items-center gap-1 font-semibold text-yellow-400">
                  <Sparkles className="w-4 h-4" /> {user?.points || 0} Points
                </span>
                <span className="flex items-center gap-1 font-semibold text-emerald-400">
                  <Award className="w-4 h-4" /> {earnedBadges.length} Badges Earned
                </span>
              </div>
            </div>
          </div>

          {/* Leaderboard Visibility Opt-in Toggle */}
          <div className="w-full md:w-auto bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-300 font-medium">Leaderboard Opt-In</p>
              <p className="text-sm font-semibold flex items-center gap-1.5 mt-0.5">
                {user?.isLeaderboardVisible !== false ? (
                  <>
                    <Eye className="w-4 h-4 text-emerald-400" /> Visible on Leaderboard
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4 text-rose-400" /> Hidden (Anonymous)
                  </>
                )}
              </p>
            </div>
            <button
              onClick={handleToggleVisibility}
              disabled={updatingVisibility}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                user?.isLeaderboardVisible !== false
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {updatingVisibility
                ? 'Updating...'
                : user?.isLeaderboardVisible !== false
                ? 'Hide Profile'
                : 'Show Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* Badges Showcase Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Badge Showcase
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track earned and locked achievements across your reading journey.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
            {earnedBadges.length} / {allBadges.length || 5} Unlocked
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allBadges.map((badge) => {
              const isEarned = earnedKeysSet.has(badge.key);
              const earnedInfo = earnedBadges.find((b) => (b.badgeKey || b.key) === badge.key);

              return (
                <div
                  key={badge.key}
                  className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                    isEarned
                      ? 'bg-white dark:bg-slate-900 border-indigo-500/30 shadow-md hover:shadow-xl hover:border-indigo-500/60'
                      : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-md ${
                          isEarned
                            ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-900'
                            : 'bg-slate-300 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isEarned ? <Award className="w-6 h-6 text-slate-950" /> : <Lock className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                          {badge.label}
                        </h4>
                        <span
                          className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md mt-0.5 ${
                            badge.tier === 'gold'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300'
                              : badge.tier === 'silver'
                              ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                              : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {badge.tier || 'bronze'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {isEarned ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Earned
                        </span>
                      ) : (
                        <span>Requires {badge.criteria?.threshold || 1} {badge.criteria?.type || 'action'}</span>
                      )}
                    </span>
                    {earnedInfo?.earnedAt && (
                      <span className="text-[10px] text-slate-400">
                        {new Date(earnedInfo.earnedAt).toLocaleDateString()}
                      </span>
                    )}
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

export default Profile;
