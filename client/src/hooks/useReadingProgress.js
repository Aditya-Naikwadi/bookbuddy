import { useState, useEffect, useRef, useCallback } from "react";
import debounce from "lodash/debounce";
import apiClient from "../api/client";
import { getLocalProgress, setLocalProgress } from "../lib/progressCache";
import { useSocket } from "./useSocket";

/**
 * Custom hook for reading progress tracking, debouncing, IndexedDB caching,
 * and real-time cross-tab synchronization via Socket.io.
 *
 * @param {string} resourceId - The ID of the resource (book or e-resource)
 * @param {object} [options={}] - Configuration options
 * @param {function} [options.onRemotePositionUpdate] - Callback when remote tab updates position
 */
export const useReadingProgress = (resourceId, options = {}) => {
  const [localProgress, setLocalProgressState] = useState(null);
  const [serverProgress, setServerProgressState] = useState(null);
  const [currentProgress, setCurrentProgress] = useState(null);
  const [discrepancy, setDiscrepancy] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const { socket } = useSocket();
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // 1. On Mount: Read local IDB cache first for instant paint, then fetch server value
  useEffect(() => {
    if (!resourceId) return;

    let isMounted = true;

    const loadProgress = async () => {
      setIsLoading(true);
      try {
        // Read local IDB cache first
        const localData = await getLocalProgress(resourceId);
        if (isMounted && localData) {
          setLocalProgressState(localData);
          setCurrentProgress(localData);
        }

        // Fetch server progress
        let serverData = null;
        try {
          const res = await apiClient.get(`/reading-progress/${resourceId}`);
          serverData = res.data?.data;
        } catch (err) {
          console.warn("Failed to fetch reading progress from server:", err);
        }

        if (isMounted) {
          if (serverData) {
            setServerProgressState(serverData);
            if (!localData) {
              setCurrentProgress(serverData);
              await setLocalProgress(resourceId, serverData).catch(() => {});
            } else {
              // Reconcile: Compare local and server positions
              const localPage =
                localData.position?.page || localData.position?.cfi || null;
              const serverPage =
                serverData.position?.page || serverData.position?.cfi || null;

              if (
                (localPage && serverPage && localPage !== serverPage) ||
                (localData.percentageComplete !== undefined &&
                  serverData.percentageComplete !== undefined &&
                  Math.abs(
                    localData.percentageComplete -
                      serverData.percentageComplete,
                  ) > 1)
              ) {
                setDiscrepancy({
                  local: localData,
                  server: serverData,
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error initializing reading progress:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProgress();

    return () => {
      isMounted = false;
    };
  }, [resourceId]);

  // 2. Core debounced server PUT function (4s delay)
  const sendServerUpdate = useCallback(
    async (data) => {
      try {
        const isOnline =
          typeof navigator !== "undefined" && "onLine" in navigator
            ? navigator.onLine
            : true;
        if (isOnline && resourceId) {
          await apiClient.put(`/reading-progress/${resourceId}`, data);
        }
      } catch (err) {
        console.error("Failed to sync progress to server:", err);
      }
    },
    [resourceId],
  );

  const debouncedSaveRef = useRef(null);

  if (debouncedSaveRef.current == null) {
    debouncedSaveRef.current = debounce((data) => {
      sendServerUpdate(data);
    }, 4000);
  }

  // 3. Save progress on reader relocation / pagechange
  const saveProgress = useCallback(
    (progressData) => {
      if (!resourceId) return;

      const payload = {
        resourceId,
        ...progressData,
        updatedAt: new Date().toISOString(),
      };

      setCurrentProgress(payload);

      // Always write to local IDB cache immediately on each tick
      setLocalProgress(resourceId, payload).catch(() => {});

      // Debounce server PUT call (4s)
      debouncedSaveRef.current(payload);
    },
    [resourceId],
  );

  // 4. Force-flush any pending write on unmount / reader close
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) {
        debouncedSaveRef.current.flush();
      }
    };
  }, []);

  // 5. Socket listener for cross-tab live repositioning
  useEffect(() => {
    if (!socket || !resourceId) return;

    const handleProgressUpdated = (event) => {
      if (event && event.resourceId === resourceId) {
        const updatedPayload = {
          resourceId,
          position: event.position,
          percentageComplete: event.percentageComplete,
          updatedAt: new Date().toISOString(),
        };

        setCurrentProgress(updatedPayload);
        setLocalProgress(resourceId, updatedPayload).catch(() => {});

        if (optionsRef.current.onRemotePositionUpdate) {
          optionsRef.current.onRemotePositionUpdate(event);
        }
      }
    };

    socket.on("progress:updated", handleProgressUpdated);

    return () => {
      socket.off("progress:updated", handleProgressUpdated);
    };
  }, [socket, resourceId]);

  const dismissDiscrepancy = useCallback(() => {
    setDiscrepancy(null);
  }, []);

  const jumpToPosition = useCallback(
    async (targetData) => {
      if (!resourceId || !targetData) return;
      setDiscrepancy(null);
      setCurrentProgress(targetData);
      await setLocalProgress(resourceId, targetData).catch(() => {});
      saveProgress(targetData);
    },
    [resourceId, saveProgress],
  );

  return {
    currentProgress,
    localProgress,
    serverProgress,
    discrepancy,
    isLoading,
    saveProgress,
    dismissDiscrepancy,
    jumpToPosition,
  };
};

export default useReadingProgress;
