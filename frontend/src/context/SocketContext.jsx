import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import socket, { connectSocket, disconnectSocket } from "../lib/socketClient";
import useAuthStore from "../store/authStore";
import { patchQueryCache } from "../lib/queryCachePatcher";
import { WifiOff } from "lucide-react";
import { SocketContext } from "./socketContextObject";

export const SocketProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const { token, isAuthenticated } = useAuthStore();
  const [isConnected, setIsConnected] = useState(() => socket.connected);
  const [isPaused, setIsPaused] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(() => new Date().toISOString());
  const lastSeenAtRef = useRef(lastSeenAt);
  const probeTimerRef = useRef(null);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      disconnectSocket();
      const timer = setTimeout(() => {
        setIsConnected(false);
        setIsPaused(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Connect singleton socket with default reconnection enabled
    socket.io.opts.reconnection = true;
    connectSocket();

    const handleConnect = () => {
      setIsConnected(true);
      setIsPaused(false);

      if (probeTimerRef.current) {
        clearInterval(probeTimerRef.current);
        probeTimerRef.current = null;
      }

      // On reconnection after a disconnect, execute reconnect resync
      if (lastSeenAtRef.current) {
        socket.emit("resync", { lastSeenAt: lastSeenAtRef.current }, (res) => {
          if (res?.success && Array.isArray(res.events)) {
            res.events.forEach(({ event, payload }) => {
              patchQueryCache(event, payload, queryClient);
            });
          }
        });
      }
    };

    const handleDisconnect = (_reason) => {
      setIsConnected(false);
      setIsPaused(true);
    };

    const startRecoveryProbe = () => {
      if (probeTimerRef.current) return;
      probeTimerRef.current = setInterval(async () => {
        try {
          // Probe if real-time mode has restored
          socket.io.opts.reconnection = true;
          socket.connect();
        } catch {
          void 0; // Ignore probe errors
        }
      }, 25000); // 25s probe
    };

    const handleConnectError = (err) => {
      setIsConnected(false);
      setIsPaused(true);

      if (err?.message?.includes("REALTIME_DISABLED")) {
        // Halt loop retries
        socket.io.opts.reconnection = false;
        startRecoveryProbe();
      }
    };

    const handleRealtimePaused = () => {
      setIsConnected(false);
      setIsPaused(true);
      socket.io.opts.reconnection = false;
      socket.disconnect();
      startRecoveryProbe();
    };

    const handleRealtimeResumed = () => {
      socket.io.opts.reconnection = true;
      socket.connect();
    };

    // Generic listener for all canonical real-time events to patch cache and update lastSeenAt
    const CANONICAL_EVENTS = [
      "loan:issued",
      "loan:returned",
      "loan:renewed",
      "reservation:ready",
      "book:updated",
      "fine:created",
      "fine:paid",
      "seat:booked",
      "seat:no_show",
      "streak:updated",
      "badge:unlocked",
      "notification:new",
      "dashboard:stats",
      // Backward-compatible events
      "loan:checkout",
      "loan:return",
      "reservation:created",
    ];

    const eventHandlers = {};
    CANONICAL_EVENTS.forEach((eventName) => {
      const handler = (payload) => {
        const now = new Date().toISOString();
        lastSeenAtRef.current = now;
        setLastSeenAt(now);
        patchQueryCache(eventName, payload, queryClient);
      };
      eventHandlers[eventName] = handler;
      socket.on(eventName, handler);
    });

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("system:realtime_paused", handleRealtimePaused);
    socket.on("system:realtime_resumed", handleRealtimeResumed);

    // Initial state check if already connected
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      if (probeTimerRef.current) {
        clearInterval(probeTimerRef.current);
        probeTimerRef.current = null;
      }
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("system:realtime_paused", handleRealtimePaused);
      socket.off("system:realtime_resumed", handleRealtimeResumed);
      CANONICAL_EVENTS.forEach((eventName) => {
        socket.off(eventName, eventHandlers[eventName]);
      });
    };
  }, [token, isAuthenticated, queryClient]);

  const value = {
    socket,
    isConnected,
    isPaused,
    refetchInterval: isPaused ? 20000 : false, // 20s polling when real-time is paused
    lastSeenAt,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
      {/* Live Updates Paused Indicator */}
      {isAuthenticated && isPaused && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-amber-950/90 border border-amber-600/40 text-amber-200 text-xs px-3.5 py-2 rounded-full shadow-lg backdrop-blur animate-in fade-in"
        >
          <WifiOff size={14} className="text-amber-400 animate-pulse" />
          <span>Live updates paused — operating in polling mode</span>
        </div>
      )}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
