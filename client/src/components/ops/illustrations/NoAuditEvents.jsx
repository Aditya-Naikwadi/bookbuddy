export default function NoAuditEvents({ className = "w-24 h-24" }) {
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
        className="fill-slate-100/50 dark:fill-slate-800/40 stroke-slate-200 dark:stroke-slate-700"
        strokeWidth="2"
      />
      <path
        d="M60 26L85 38V58C85 75 74 90 60 96C46 90 35 75 35 58V38L60 26Z"
        className="fill-white dark:fill-slate-800 stroke-indigo-500 dark:stroke-indigo-400"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M52 58L58 64L68 52"
        className="stroke-emerald-500"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
