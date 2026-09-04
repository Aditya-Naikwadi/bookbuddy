import { io } from "socket.io-client";

const getSocketUrl = () => {
  const envUrl =
    import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
  }
  return typeof window !== "undefined" ? window.location.origin : "";
};

const SOCKET_URL = getSocketUrl();

const socket = io(SOCKET_URL, {
  autoConnect: false, // Connected manually upon authentication
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on("connect_error", (err) => {
  if (import.meta.env.DEV) {
    console.warn("[Socket Connection Warning]:", err.message);
  }
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;
