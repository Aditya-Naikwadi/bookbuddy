import { io } from "socket.io-client";

const SOCKET_URL = typeof window !== "undefined" ? window.location.origin : "";

const socket = io(SOCKET_URL, {
  autoConnect: false, // We'll connect manually when logged in
});

export default socket;
