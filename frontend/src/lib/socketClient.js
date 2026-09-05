import { io } from "socket.io-client";
import { getInMemoryToken } from "../api/client";

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
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  auth: (cb) => {
    const token =
      getInMemoryToken() ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("token")
        : null);
    cb({ token: token || undefined });
  },
});

socket.on("connect_error", (err) => {
  if (import.meta.env.DEV) {
    console.warn("[Socket Connection Warning]:", err.message);
  }
});

export const connectSocket = () => {
  const token =
    getInMemoryToken() ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("token")
      : null);
  socket.auth = { token: token || undefined };
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
