import { Monitor, Cpu, Clock, CheckCircle2, Users, Zap } from "lucide-react";

export const LiveWorkstationBoard = ({
  workstations = [],
  isLoading = false,
  onSelectWorkstation,
  onJoinQueue,
  weeklyPcHoursUsed = 0,
  maxPcHours = 12,
  userActiveQueue = [],
}) => {
  const pcQuotaRemainingHours = Math.max(
    0,
    maxPcHours - Math.round((weeklyPcHoursUsed / 60) * 10) / 10,
  );
  const pcQuotaPercent = Math.min(
    100,
    Math.round((weeklyPcHoursUsed / (maxPcHours * 60)) * 100),
  );

  // Compute available vs occupied count
  const availableCount = workstations.filter(
    (w) => w.status === "available" && !w.isCurrentlyBooked,
  ).length;
  const totalCount = workstations.length;

  return (
    <div className="space-y-6">
      {/* Live Horizon Notice & Quota Meter Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Live Horizon (Next 60 Minutes)</span>
            </div>
            <h2 className="text-2xl font-serif font-black tracking-tight">
              Live Workstation & PC Board
            </h2>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Equipped high-performance terminals. To ensure fair access,
              workstations are bookable exclusively within{" "}
              <strong className="text-white">1 hour</strong> of your desired
              slot.
            </p>
          </div>

          {/* Quota Gauge */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl w-full md:w-64 shrink-0">
            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
              <span className="text-slate-300">PC Quota (12h Cap)</span>
              <span
                className={
                  pcQuotaPercent >= 90 ? "text-amber-300" : "text-emerald-300"
                }
              >
                {pcQuotaRemainingHours}h left
              </span>
            </div>
            <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  pcQuotaPercent >= 90
                    ? "bg-amber-400"
                    : "bg-gradient-to-r from-emerald-400 to-indigo-400"
                }`}
                style={{ width: `${pcQuotaPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Independent from your 30h study seat quota.
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <span className="text-lg font-mono font-black">
                {availableCount}
              </span>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Free Right Now
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Monitor size={18} />
            </div>
            <div>
              <span className="text-lg font-mono font-black">{totalCount}</span>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Total Stations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock size={18} />
            </div>
            <div>
              <span className="text-lg font-mono font-black">60 min</span>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Slot Horizon
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Workstations Grid List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 bg-slate-100 rounded-3xl border border-slate-200"
            />
          ))}
        </div>
      ) : workstations.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
          <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-serif font-bold text-slate-700">
            No Workstations Registered
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Check back soon or consult your librarian.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workstations.map((station) => {
            const isFree =
              station.status === "available" && !station.isCurrentlyBooked;
            const isMaintenance = station.status === "maintenance";
            const isOccupied = !isFree && !isMaintenance;

            const isUserQueued = userActiveQueue.some(
              (q) =>
                q.resourceGroupId?._id === station.groupId ||
                q.resourceId === station._id,
            );

            return (
              <div
                key={station._id}
                className={`p-5 rounded-3xl border transition-all duration-200 flex flex-col justify-between ${
                  isFree
                    ? "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-lg"
                    : isMaintenance
                      ? "bg-slate-50 border-slate-200 opacity-60"
                      : "bg-slate-50/80 border-slate-200"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                          isFree
                            ? "bg-indigo-50 text-indigo-600"
                            : isMaintenance
                              ? "bg-slate-200 text-slate-500"
                              : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        <Monitor size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">
                          {station.label}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {station.groupName || "Workstation"}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        isFree
                          ? "bg-emerald-100 text-emerald-700"
                          : isMaintenance
                            ? "bg-slate-200 text-slate-600"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isFree
                        ? "Free Now"
                        : isMaintenance
                          ? "Maintenance"
                          : "Occupied"}
                    </span>
                  </div>

                  {/* Terminal Specs / Features */}
                  <div className="space-y-1.5 my-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Cpu size={13} className="text-slate-400" />
                      <span>
                        {station.specs || "GPU Computing • High-Speed Uplink"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Clock size={13} className="text-slate-400" />
                      <span>Slots: 60 minutes • 10-min check-in grace</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 mt-2">
                  {isFree ? (
                    <button
                      onClick={() => onSelectWorkstation(station)}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <Zap size={14} />
                      <span>Book Free Slot (Next Hour)</span>
                    </button>
                  ) : isOccupied ? (
                    <button
                      onClick={() => onJoinQueue(station)}
                      disabled={isUserQueued}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 focus:ring-2 focus:outline-none ${
                        isUserQueued
                          ? "bg-indigo-100 text-indigo-700 cursor-not-allowed"
                          : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs focus:ring-slate-700"
                      }`}
                    >
                      <Users size={14} />
                      <span>
                        {isUserQueued
                          ? "You are on Waitlist"
                          : "Join Next-Slot Queue"}
                      </span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2 rounded-xl bg-slate-100 text-slate-400 text-xs font-medium cursor-not-allowed"
                    >
                      Under Maintenance
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
