import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import useAuthStore from "../store/authStore";

const SOCKET_URL = typeof window !== "undefined" ? window.location.origin : "";

export const useSocket = () => {
  const { token } = useAuthStore();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
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
    };
  }, [token]);

  return {
    socket,
    isConnected,
  };
};

export default useSocket;
