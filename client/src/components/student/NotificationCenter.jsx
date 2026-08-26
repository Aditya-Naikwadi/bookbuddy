import { Bell, CheckCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../../hooks/useSocket";
import { useReducedMotion } from "../../hooks/useReducedMotion";

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    type: "alert",
    title: "Book Available!",
    message: '"Clean Code" is now available to borrow.',
    time: "10 mins ago",
    read: false,
  },
  {
    id: 2,
    type: "reminder",
    title: "Due Date Reminder",
    message: '"The Pragmatic Programmer" is due in 5 days.',
    time: "2 hours ago",
    read: false,
  },
  {
    id: 3,
    type: "system",
    title: "Maintenance Notice",
    message: "Library closed on Friday.",
    time: "1 day ago",
    read: true,
  },
];

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const { socket } = useSocket();
  const prefersReducedMotion = useReducedMotion();

  // Listen to Socket.io events
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (newNotif) => {
      setNotifications((prev) => [
        {
          id: newNotif._id || Date.now(),
          title: newNotif.title || "Live Library Event",
          message: newNotif.message || "Library status updated",
          time: "Just now",
          read: false,
        },
        ...prev,
      ]);
      setHasNewAlert(true);
      setTimeout(() => setHasNewAlert(false), 3000);
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("streak:updated", handleNewNotification);
    socket.on("loan:updated", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("streak:updated", handleNewNotification);
      socket.off("loan:updated", handleNewNotification);
    };
  }, [socket]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        animate={
          hasNewAlert && !prefersReducedMotion
            ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.1, 1] }
            : {}
        }
        transition={{ duration: 0.5 }}
        whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-surface animate-pulse" />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 10, scale: 0.95 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 10, scale: 0.95 }
            }
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-80 bg-white dark:bg-surface rounded-2xl shadow-2xl border border-slate-200 dark:border-edge z-50 overflow-hidden font-sans text-xs"
          >
            <div className="p-4 border-b border-slate-100 dark:border-edge flex justify-between items-center bg-slate-50/70 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-ink text-sm flex items-center gap-2">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black">
                    {unreadCount}
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  No notifications
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      setNotifications((prev) =>
                        prev.map((n) =>
                          n.id === notif.id ? { ...n, read: true } : n,
                        ),
                      );
                    }}
                    className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex flex-col gap-0.5 ${
                      !notif.read ? "bg-indigo-50/40 dark:bg-indigo-950/30" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h4
                        className={`text-xs ${
                          !notif.read
                            ? "font-bold text-slate-900 dark:text-ink"
                            : "font-medium text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {notif.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-muted leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 text-center border-t border-slate-100 dark:border-edge bg-slate-50/50 dark:bg-slate-900/50">
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-ink transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
