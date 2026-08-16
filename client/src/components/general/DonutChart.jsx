const DonutChart = ({
  data = [
    { label: "Computer Science", value: 35, color: "#4F46E5" },
    { label: "Literature", value: 25, color: "#10B981" },
    { label: "Economics", value: 20, color: "#F59E0B" },
    { label: "Architecture", value: 20, color: "#8B5CF6" },
  ],
  size = 100,
  strokeWidth = 14,
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accum = 0;
  const segments = [];
  for (const item of data) {
    const strokeDasharray = `${(item.value / total) * circumference} ${circumference}`;
    const strokeDashoffset = -accum * circumference;
    accum += item.value / total;
    segments.push({ ...item, strokeDasharray, strokeDashoffset });
  }

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
          {segments.map((item, index) => (
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
          <span className="text-xs font-bold text-slate-800 tracking-tight">
            {total}%
          </span>
          <span className="text-[9px] text-slate-400 font-medium">
            Categories
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-600 font-medium truncate max-w-[90px]">
              {item.label}
            </span>
            <span className="text-slate-400 font-semibold text-[10px] ml-auto">
              {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
