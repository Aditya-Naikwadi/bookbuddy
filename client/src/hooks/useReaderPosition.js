import { useState, useEffect, useRef } from "react";
import apiClient from "../api/client";
import { useReadingProgress } from "./useReadingProgress";

export const useReaderPosition = (resourceId, userId, rendition, pdfState) => {
  const [currentCfi, setCurrentCfi] = useState(null);
  const [currentPageState, setCurrentPageState] = useState(1);
  const [percentCompleteState, setPercentCompleteState] = useState(0);
  const [readingTimeSeconds, setReadingTimeSeconds] = useState(0);

  const secondsRef = useRef(0);
  const lastSyncRef = useRef(0);
  const localKey = `bookbuddy_position_${userId}_${resourceId}`;

  // Cross-tab socket reposition handler
  const handleRemotePositionUpdate = (event) => {
    if (!event || !event.position) return;
    const { cfi, page } = event.position;
    if (cfi && rendition) {
      rendition.display(cfi);
      setCurrentCfi(cfi);
    } else if (page && pdfState?.setPdfPage) {
      pdfState.setPdfPage(page);
      setCurrentPageState(page);
    }
    if (event.percentageComplete !== undefined) {
      setPercentCompleteState(event.percentageComplete);
    }
  };

  const {
    currentProgress,
    discrepancy,
    saveProgress,
    dismissDiscrepancy,
    jumpToPosition,
  } = useReadingProgress(resourceId, {
    onRemotePositionUpdate: handleRemotePositionUpdate,
  });

  // Synchronize state when currentProgress changes during render (prevents cascading effect renders)
  const [prevProgress, setPrevProgress] = useState(null);
  if (currentProgress !== prevProgress) {
    setPrevProgress(currentProgress);
    if (currentProgress) {
      const pos = currentProgress.position || {};
      if (pos.cfi) setCurrentCfi(pos.cfi);
      if (pos.page) setCurrentPageState(pos.page);
      if (currentProgress.percentageComplete !== undefined) {
        setPercentCompleteState(currentProgress.percentageComplete);
      }
    }
  }

  const initialPosition = currentProgress?.position || null;

  // 2. EPUB position relocation listener & debounced save
  useEffect(() => {
    if (!rendition) return;

    if (initialPosition?.cfi) {
      rendition.display(initialPosition.cfi);
    }

    const handleRelocate = (location) => {
      const cfi = location.start.cfi;
      const percent = Math.round((location.start.percentage || 0) * 100);

      setCurrentCfi(cfi);
      setPercentCompleteState(percent);

      saveProgress({
        position: { cfi, page: currentPageState },
        percentageComplete: percent,
      });

      try {
        localStorage.setItem(
          localKey,
          JSON.stringify({ cfi, progressPercentage: percent, timestamp: Date.now() }),
        );
      } catch (e) {
        console.error("Failed to save local position backup:", e);
      }
    };

    rendition.on("relocated", handleRelocate);
    return () => {
      rendition.off("relocated", handleRelocate);
    };
  }, [rendition, initialPosition, resourceId, localKey, saveProgress, currentPageState]);

  // 3. PDF position tracking listener & debounced save
  const { page: pdfPage, totalPages: pdfTotalPages } = pdfState || {};
  useEffect(() => {
    if (!pdfPage || !pdfTotalPages || pdfTotalPages <= 0) return;

    const percent = Math.round((pdfPage / pdfTotalPages) * 100);

    saveProgress({
      position: { page: pdfPage, totalPages: pdfTotalPages },
      percentageComplete: percent,
    });

    try {
      localStorage.setItem(
        localKey,
        JSON.stringify({
          page: pdfPage,
          totalPages: pdfTotalPages,
          progressPercentage: percent,
          timestamp: Date.now(),
        }),
      );
    } catch (e) {
      console.error("Failed to save PDF position backup:", e);
    }
  }, [pdfPage, pdfTotalPages, resourceId, localKey, saveProgress]);

  const currentPage = pdfState?.page || currentPageState;
  const percentComplete =
    pdfState?.page && pdfState?.totalPages
      ? Math.round((pdfState.page / pdfState.totalPages) * 100)
      : percentCompleteState;

  // 4. Reading time counter & periodic heartbeat
  useEffect(() => {
    if (!resourceId) return;

    const syncProgressToServer = async (seconds) => {
      try {
        await apiClient
          .post(`/eresources/${resourceId}/progress`, {
            dailySecondsToday: seconds,
            readingTimeMinutes: Math.floor(seconds / 60),
          })
          .catch(() => {});
        lastSyncRef.current = seconds;
      } catch (e) {
        console.error("Failed to sync reading time:", e);
      }
    };

    const timer = setInterval(() => {
      secondsRef.current += 1;
      setReadingTimeSeconds(secondsRef.current);

      if (secondsRef.current - lastSyncRef.current >= 30) {
        syncProgressToServer(secondsRef.current);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      if (secondsRef.current > lastSyncRef.current) {
        syncProgressToServer(secondsRef.current);
      }
    };
  }, [resourceId]);

  return {
    currentCfi,
    currentPage,
    percentComplete,
    readingTimeSeconds,
    initialPosition,
    discrepancy,
    dismissDiscrepancy,
    jumpToPosition,
  };
};

export default useReaderPosition;
