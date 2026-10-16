import { createContext, useContext } from "react";

export const SocketContext = createContext({
  socket: null,
  isConnected: false,
  isPaused: false,
  refetchInterval: false,
  lastSeenAt: null,
});

export const useSocketContext = () => useContext(SocketContext);

export default SocketContext;
