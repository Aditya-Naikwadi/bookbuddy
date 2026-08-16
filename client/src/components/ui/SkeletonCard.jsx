export const SkeletonCard = ({ count = 3, className = "" }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-sm animate-shimmer flex flex-col justify-between h-[220px] ${className}`}
          aria-hidden="true"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80" />
              <div className="w-16 h-5 rounded-lg bg-slate-800/80" />
            </div>
            <div className="w-3/4 h-5 rounded-md bg-slate-800/80" />
            <div className="w-full h-4 rounded-md bg-slate-800/60" />
            <div className="w-2/3 h-4 rounded-md bg-slate-800/60" />
          </div>
          <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
            <div className="w-24 h-4 rounded-md bg-slate-800/60" />
            <div className="w-20 h-7 rounded-xl bg-slate-800/80" />
          </div>
        </div>
      ))}
    </>
  );
};

export default SkeletonCard;
