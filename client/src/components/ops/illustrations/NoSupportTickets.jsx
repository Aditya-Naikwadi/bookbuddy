export default function NoSupportTickets({ className = "w-24 h-24" }) {
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
        className="fill-cyan-50/50 dark:fill-cyan-950/30 stroke-cyan-200 dark:stroke-cyan-800"
        strokeWidth="2"
      />
      <rect
        x="32"
        y="36"
        width="56"
        height="44"
        rx="10"
        className="fill-white dark:fill-slate-800 stroke-cyan-500 dark:stroke-cyan-400"
        strokeWidth="2.5"
      />
      <path
        d="M45 80L38 90V80H45Z"
        className="fill-cyan-500 dark:fill-cyan-400"
      />
      <circle cx="48" cy="58" r="4" className="fill-emerald-500" />
      <circle cx="60" cy="58" r="4" className="fill-emerald-500" />
      <circle cx="72" cy="58" r="4" className="fill-emerald-500" />
    </svg>
  );
}
