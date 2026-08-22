import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  LayoutDashboard,
  Activity,
  Users,
  Building2,
  Clock,
  ShieldAlert,
  Database,
  HelpCircle,
  FileText,
  Sliders,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const MODULE_COMMANDS = [
  {
    id: "nav-overview",
    title: "System Telemetry Overview",
    subtitle: "Cluster metrics, active students, and memory heap diagnostics",
    icon: Activity,
    path: "/admin-portal/overview",
    category: "Navigation",
  },
  {
    id: "nav-colleges",
    title: "College Tenant Manager",
    subtitle: "Provision, edit, and configure institutional tenant scopes",
    icon: Building2,
    path: "/admin-portal/colleges",
    category: "Navigation",
  },
  {
    id: "nav-users",
    title: "Cross-Tenant User Directory",
    subtitle: "Search, inspect, and update roles for all platform users",
    icon: Users,
    path: "/admin-portal/users",
    category: "Navigation",
  },
  {
    id: "nav-onboarding",
    title: "Tenant Onboarding Queue",
    subtitle: "Review and approve pending institutional registration requests",
    icon: Clock,
    path: "/admin-portal/onboarding",
    category: "Navigation",
  },
  {
    id: "nav-moderation",
    title: "Global Content Moderation",
    subtitle: "Review flagged reviews, discussion comments, and reported media",
    icon: ShieldAlert,
    path: "/admin-portal/content-moderation",
    category: "Navigation",
  },
  {
    id: "nav-data",
    title: "Global Data & Fines Oversight",
    subtitle:
      "Cross-tenant circulation loans, catalog holdings, and fine collection logs",
    icon: Database,
    path: "/admin-portal/data-oversight",
    category: "Navigation",
  },
  {
    id: "nav-support",
    title: "Global Support Escalations",
    subtitle: "Cross-tenant helpdesk ticket queue and complaint responses",
    icon: HelpCircle,
    path: "/admin-portal/support-queue",
    category: "Navigation",
  },
  {
    id: "nav-audit",
    title: "Security Audit Trail",
    subtitle:
      "Immutable log stream of security events and administrative actions",
    icon: FileText,
    path: "/admin-portal/audit-logs",
    category: "Navigation",
  },
  {
    id: "nav-settings",
    title: "System Configuration & Backups",
    subtitle:
      "SMTP parameters, maintenance mode toggles, and database snapshots",
    icon: Sliders,
    path: "/admin-portal/system-settings",
    category: "Navigation",
  },
  {
    id: "nav-home",
    title: "Administrator Command Hub",
    subtitle: "Return to the main operations portal dashboard grid",
    icon: LayoutDashboard,
    path: "/admin-portal",
    category: "Navigation",
  },
];

export default function OpsCommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setQuery("");
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return MODULE_COMMANDS;
    const q = query.toLowerCase();
    return MODULE_COMMANDS.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.subtitle.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q),
    );
  }, [query]);

  const activeIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredCommands.length - 1),
  );

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[activeIndex]) {
        executeCommand(filteredCommands[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const executeCommand = (cmd) => {
    onClose();
    if (cmd.path) {
      navigate(cmd.path);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-start justify-center pt-20 px-4 transition-all"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden font-sans text-xs flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-edge flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search Administrator modules (Ctrl+K)..."
            className="w-full bg-transparent text-slate-900 dark:text-ink text-sm font-medium focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Command List Container */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100/50 dark:divide-slate-800/50">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              No operational commands found matching "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon || Sparkles;
              const isSelected = idx === activeIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-ink text-xs flex items-center gap-2">
                        <span>{cmd.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal">
                          {cmd.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-muted mt-0.5 font-normal">
                        {cmd.subtitle}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-3 bg-slate-50/70 dark:bg-slate-900/60 border-t border-slate-100 dark:border-edge flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Use{" "}
              <strong className="text-slate-700 dark:text-slate-300">↑↓</strong>{" "}
              to navigate
            </span>
            <span>
              <strong className="text-slate-700 dark:text-slate-300">↵</strong>{" "}
              to select
            </span>
          </div>
          <span>BookBuddy Administrator Portal</span>
        </div>
      </div>
    </div>
  );
}
