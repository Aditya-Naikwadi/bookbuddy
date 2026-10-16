import { useSocketContext } from "../context/socketContextObject";

/**
 * useSocket hook now subscribes to the singleton SocketProvider context.
 * Guarantees exactly 1 WebSocket TCP connection per browser tab, avoiding connection duplication.
 */
export const useSocket = () => {
  return useSocketContext();
};

export default useSocket;
