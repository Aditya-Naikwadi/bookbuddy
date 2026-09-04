import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import useAuthStore from "../store/authStore";

const getSocketUrl = () => {
  const envUrl =
    import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
  }
  return typeof window !== "undefined" ? window.location.origin : "";
};

const SOCKET_URL = getSocketUrl();

export const useSocket = () => {
  const { token, isAuthenticated } = useAuthStore();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      return;
    }

    const instance = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: { token },
    });

    const handleConnect = () => {
      setSocket(instance);
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    instance.on("connect", handleConnect);
    instance.on("disconnect", handleDisconnect);

    return () => {
      instance.off("connect", handleConnect);
      instance.off("disconnect", handleDisconnect);
      instance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [token, isAuthenticated]);

  return {
    socket,
    isConnected,
  };
};

export default useSocket;
