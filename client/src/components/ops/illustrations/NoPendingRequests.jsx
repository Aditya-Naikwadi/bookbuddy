export default function NoPendingRequests({ className = "w-24 h-24" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="60"
        cy="60"
        r="54"
        className="fill-indigo-50/50 dark:fill-indigo-950/30 stroke-indigo-200 dark:stroke-indigo-800"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <rect
        x="35"
        y="28"
        width="50"
        height="64"
        rx="8"
        className="fill-white dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-700"
        strokeWidth="2"
      />
      <line
        x1="45"
        y1="42"
        x2="75"
        y2="42"
        className="stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="45"
        y1="52"
        x2="65"
        y2="52"
        className="stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="45"
        y1="62"
        x2="70"
        y2="62"
        className="stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="76"
        cy="76"
        r="16"
        className="fill-emerald-500 stroke-white dark:stroke-slate-900"
        strokeWidth="3"
      />
      <path
        d="M70 76L74 80L82 72"
        className="stroke-white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
