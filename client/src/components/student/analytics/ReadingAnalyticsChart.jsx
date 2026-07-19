import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, TrendingUp, BookOpen, Clock, Calendar } from 'lucide-react';

const fetchReadingAnalytics = async (days) => {
  const { data } = await apiClient.get(`/dashboards/student/reading-analytics?days=${days}`);
  return data.data;
};

export const ReadingAnalyticsChart = () => {
  const [days, setDays] = useState(7);
  const [activeMetric, setActiveMetric] = useState('pages'); // 'pages' | 'minutes'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const { data: analyticsData, isLoading, isError } = useQuery({
    queryKey: ['reading-analytics', days],
    queryFn: () => fetchReadingAnalytics(days),
    staleTime: 60000,
  });

  const chartPoints = analyticsData?.analytics || [];
  const isEmpty = analyticsData?.isEmpty || chartPoints.every((p) => p.pagesRead === 0 && p.minutesRead === 0);

  const totalPages = analyticsData?.totalPagesRead || chartPoints.reduce((acc, p) => acc + (p.pagesRead || 0), 0);
  const totalMinutes = analyticsData?.totalMinutesRead || chartPoints.reduce((acc, p) => acc + (p.minutesRead || 0), 0);

  const values = chartPoints.map((p) => (activeMetric === 'pages' ? p.pagesRead : p.minutesRead));
  const maxValue = Math.max(...values, 10);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
            <BarChart2 size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Reading Activity Analytics
            </h3>
            <p className="text-xs text-slate-500">Track daily pages read and session duration</p>
          </div>
        </div>

        {/* Timeframe & Metric Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveMetric('pages')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                activeMetric === 'pages'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpen size={13} />
              <span>Pages</span>
            </button>
            <button
              onClick={() => setActiveMetric('minutes')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                activeMetric === 'minutes'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock size={13} />
              <span>Minutes</span>
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setDays(7)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                days === 7
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDays(30)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                days === 30
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Total Pages ({days}D)
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{totalPages}</p>
          </div>
          <BookOpen className="text-indigo-400 opacity-80" size={24} />
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Total Minutes ({days}D)
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{totalMinutes}</p>
          </div>
          <Clock className="text-purple-400 opacity-80" size={24} />
        </div>
      </div>

      {/* Chart Canvas Container */}
      {isLoading ? (
        <div className="h-52 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl flex items-center justify-center text-xs text-slate-400">
          Loading reading analytics...
        </div>
      ) : isError ? (
        <div className="h-52 bg-red-500/5 rounded-2xl flex items-center justify-center text-xs text-red-500 font-medium">
          Failed to load reading analytics.
        </div>
      ) : isEmpty ? (
        /* Sensible Empty State for students with no history */
        <div className="py-12 px-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <Calendar size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Reading Activity Yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Your reading activity graph will automatically populate here as you read digital resources or log daily check-ins.
          </p>
        </div>
      ) : (
        /* Interactive Recharts-style SVG Bar/Area Chart */
        <div className="relative pt-6 pb-2">
          <div className="h-48 w-full flex items-end justify-between gap-1.5 sm:gap-2 px-1 relative">
            {/* Grid Line Overlay */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-b border-slate-300 dark:border-slate-700 w-full" />
              <div className="border-b border-slate-300 dark:border-slate-700 w-full" />
              <div className="border-b border-slate-300 dark:border-slate-700 w-full" />
            </div>

            {chartPoints.map((point, index) => {
              const val = activeMetric === 'pages' ? point.pagesRead : point.minutesRead;
              const heightPct = Math.max(6, (val / maxValue) * 100);
              const isHovered = hoveredPoint?.date === point.date;

              return (
                <div
                  key={point.date || index}
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer z-10"
                >
                  {/* Hover Tooltip */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: -5, scale: 1 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute bottom-full mb-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-xl z-30 whitespace-nowrap pointer-events-none"
                      >
                        <p>{point.date}</p>
                        <p className="text-indigo-300 dark:text-indigo-600 font-extrabold">
                          {point.pagesRead} Pages • {point.minutesRead} Mins
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Animated Bar */}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 0.4, delay: index * 0.02 }}
                    className={`w-full max-w-[28px] rounded-t-xl transition-all duration-200 ${
                      isHovered
                        ? 'bg-gradient-to-t from-indigo-600 to-purple-500 shadow-lg scale-105'
                        : val > 0
                        ? 'bg-indigo-600/85 dark:bg-indigo-500/85 hover:bg-indigo-600'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />

                  {/* Day Label (X-Axis) */}
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-2 truncate max-w-full">
                    {days === 7 ? point.day : point.date.split('-')[2]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingAnalyticsChart;
