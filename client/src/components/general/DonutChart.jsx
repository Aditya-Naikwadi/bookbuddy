const DonutChart = ({ data = [], size = 100, strokeWidth = 14 }) => {
  const rawTotal = (data || []).reduce(
    (sum, item) => sum + (item.value || 0),
    0,
  );
  const total = rawTotal;
  const effectiveTotal = rawTotal > 0 ? rawTotal : 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accum = 0;
  const segments = [];
  for (const item of data) {
    const val = item.value || 0;
    const strokeDasharray = `${(val / effectiveTotal) * circumference} ${circumference}`;
    const strokeDashoffset = -accum * circumference;
    accum += val / effectiveTotal;
    segments.push({ ...item, strokeDasharray, strokeDashoffset });
  }

  const isEmpty = !data || data.length === 0 || rawTotal === 0;

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Neutral track ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200 dark:text-slate-800"
          />
          {!isEmpty &&
            segments.map((item, index) => (
              <circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={item.strokeDasharray}
                strokeDashoffset={item.strokeDashoffset}
                className="transition-all duration-500 ease-out"
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {total}%
          </span>
          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
            Categories
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs flex-1">
        {isEmpty ? (
          <div className="col-span-2 text-[11px] text-slate-400 dark:text-slate-500 italic">
            No category distribution available
          </div>
        ) : (
          data.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[90px]">
                {item.label}
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-semibold text-[10px] ml-auto">
                {item.value}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DonutChart;
