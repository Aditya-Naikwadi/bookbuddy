const SparklineChart = ({
  data = null,
  color = "#4F46E5",
  height = 36,
  width = 120,
}) => {
  const hasValidData =
    Array.isArray(data) &&
    data.length >= 2 &&
    data.some((val) => val !== 0 && !isNaN(val));

  if (!hasValidData) {
    const centerY = height / 2;
    return (
      <div
        className="relative inline-flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 font-medium"
        style={{ width, height }}
      >
        <svg width={width} height={height} className="overflow-visible">
          <line
            x1="0"
            y1={centerY}
            x2={width}
            y2={centerY}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="text-slate-300 dark:text-slate-700"
          />
        </svg>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const areaD = `M 0,${height} L ${points.join(" L ")} L ${width},${height} Z`;
  const lastPoint = points[points.length - 1].split(",");

  return (
    <div
      className="relative inline-flex items-center"
      style={{ width, height }}
    >
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkline-grad)" />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r="3"
          fill={color}
          className="animate-pulse"
        />
      </svg>
    </div>
  );
};

export default SparklineChart;
