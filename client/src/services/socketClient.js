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
  autoConnect: false, // We'll connect manually when logged in
});

export default socket;
