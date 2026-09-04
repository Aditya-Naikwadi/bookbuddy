import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../../api/client";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../../../hooks/useSocket";
import {
  Bell,
  X,
  CheckCheck,
  Flame,
  BookOpen,
  AlertCircle,
  Sparkles,
  Info,
  Clock,
} from "lucide-react";

const fetchNotifications = async () => {
  const { data } = await apiClient.get("/notifications/me?limit=20");
  return data.data || [];
};

export const NotificationDrawer = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 15000,
    enabled: isOpen,
  });

  // Listen to live socket 'notification:new' event
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (newNotification) => {
      queryClient.setQueryData(["notifications"], (old = []) => [
        newNotification,
        ...old,
      ]);
      queryClient.invalidateQueries({ queryKey: ["student-overview"] });
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [socket, queryClient]);

  // Mark single notification read with Optimistic UI update
  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.patch(`/notifications/${id}/read`);
      return data;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      await queryClient.cancelQueries({ queryKey: ["student-overview"] });

      const prevNotifications = queryClient.getQueryData(["notifications"]);
      if (prevNotifications) {
        queryClient.setQueryData(
          ["notifications"],
          prevNotifications.map((n) =>
            n._id === id ? { ...n, read: true } : n,
          ),
        );
      }
      return { prevNotifications };
    },
    onError: (err, id, context) => {
      if (context?.prevNotifications) {
        queryClient.setQueryData(["notifications"], context.prevNotifications);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["student-overview"] });
    },
  });

  // Mark all read mutation with Optimistic UI update
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.patch("/notifications/read-all");
      return data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      await queryClient.cancelQueries({ queryKey: ["student-overview"] });

      const prevNotifications = queryClient.getQueryData(["notifications"]);
      if (prevNotifications) {
        queryClient.setQueryData(
          ["notifications"],
          prevNotifications.map((n) => ({ ...n, read: true })),
        );
      }
      return { prevNotifications };
    },
    onError: (err, vars, context) => {
      if (context?.prevNotifications) {
        queryClient.setQueryData(["notifications"], context.prevNotifications);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["student-overview"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getTypeIcon = (type) => {
    switch (type) {
      case "streak_milestone":
        return <Flame className="text-orange-500" size={16} />;
      case "loan_due":
      case "loan_overdue":
        return <AlertCircle className="text-red-500" size={16} />;
      case "reservation_ready":
        return <BookOpen className="text-purple-500" size={16} />;
      default:
        return <Sparkles className="text-indigo-500" size={16} />;
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diffMs = new Date() - new Date(dateStr);
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Drawer Slide-Over Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black">
                        {unreadCount}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live library updates & notifications
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading ? (
                <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Fetching notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                  <Info
                    size={36}
                    className="mx-auto text-slate-300 dark:text-slate-700"
                  />
                  <p className="font-bold text-slate-700 dark:text-slate-300">
                    No Notifications
                  </p>
                  <p className="text-slate-500">You are all caught up!</p>
                </div>
              ) : (
                notifications.map((item) => (
                  <motion.div
                    key={item._id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() =>
                      !item.read && markReadMutation.mutate(item._id)
                    }
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative ${
                      item.read
                        ? "bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/60 opacity-80"
                        : "bg-white dark:bg-slate-800 border-indigo-100 dark:border-indigo-900/50 shadow-sm"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex-shrink-0 mt-0.5">
                      {getTypeIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                        <Clock size={11} />
                        <span>{formatTimeAgo(item.createdAt)}</span>
                      </div>

                      {/* Direct One-Tap Action for Book Availability / Hold Ready Notifications */}
                      {(item.type === "book_available" ||
                        item.type === "hold_ready" ||
                        item.relatedType === "Book") &&
                        item.relatedId && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await apiClient.post(
                                    "/dashboards/student/reservations",
                                    {
                                      bookId: item.relatedId,
                                    },
                                  );
                                  alert("Hold placed successfully!");
                                } catch (err) {
                                  alert(
                                    err.response?.data?.message ||
                                      "Failed to place hold.",
                                  );
                                }
                              }}
                              className="px-3 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                            >
                              Reserve Now (Place Hold)
                            </button>
                          </div>
                        )}
                    </div>

                    {!item.read && (
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 absolute top-4 right-3" />
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NotificationDrawer;
