import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';

export const useReaderPosition = (resourceId, userId, rendition, pdfState) => {
  const [currentCfi, setCurrentCfi] = useState(null);
  const [currentPageState, setCurrentPageState] = useState(1);
  const [percentCompleteState, setPercentCompleteState] = useState(0);
  const [readingTimeSeconds, setReadingTimeSeconds] = useState(0);
  const [initialPosition, setInitialPosition] = useState(null);

  const secondsRef = useRef(0);
  const lastSyncRef = useRef(0);
  const localKey = `bookbuddy_position_${userId}_${resourceId}`;

  // 1. Restore position on mount from backend or local cache
  useEffect(() => {
    if (!resourceId) return;

    const loadSavedPosition = async () => {
      try {
        let savedData = null;
        try {
          const { data } = await apiClient.get(`/reader/${resourceId}/position`);
          savedData = data.data;
        } catch {
          const cached = localStorage.getItem(localKey);
          if (cached) savedData = JSON.parse(cached);
        }

        if (savedData) {
          setInitialPosition(savedData);
          if (savedData.cfi) setCurrentCfi(savedData.cfi);
          if (savedData.page) setCurrentPageState(savedData.page);
          if (savedData.progressPercentage) setPercentCompleteState(savedData.progressPercentage);
        }
      } catch (e) {
        console.error('Failed to load saved reader position:', e);
      }
    };

    loadSavedPosition();
  }, [resourceId, localKey]);

  // 2. EPUB position restoration & tracking
  useEffect(() => {
    if (!rendition) return;

    if (initialPosition?.cfi) {
      rendition.display(initialPosition.cfi);
    }

    const handleRelocate = async (location) => {
      const cfi = location.start.cfi;
      const percent = Math.round((location.start.percentage || 0) * 100);

      setCurrentCfi(cfi);
      setPercentCompleteState(percent);

      const payload = { cfi, progressPercentage: percent, timestamp: Date.now() };

      try {
        localStorage.setItem(localKey, JSON.stringify(payload));
        await apiClient.put(`/reader/${resourceId}/position`, payload).catch(() => {});
      } catch (e) {
        console.error('Failed to save EPUB position:', e);
      }
    };

    rendition.on('relocated', handleRelocate);
    return () => {
      rendition.off('relocated', handleRelocate);
    };
  }, [rendition, initialPosition, resourceId, localKey]);

  // 3. PDF position tracking & sync
  const { page: pdfPage, totalPages: pdfTotalPages } = pdfState || {};
  useEffect(() => {
    if (!pdfPage || !pdfTotalPages || pdfTotalPages <= 0) return;

    const percent = Math.round((pdfPage / pdfTotalPages) * 100);
    const payload = { page: pdfPage, totalPages: pdfTotalPages, progressPercentage: percent, timestamp: Date.now() };

    try {
      localStorage.setItem(localKey, JSON.stringify(payload));
      apiClient.put(`/reader/${resourceId}/position`, payload).catch(() => {});
    } catch (e) {
      console.error('Failed to save PDF position:', e);
    }
  }, [pdfPage, pdfTotalPages, resourceId, localKey]);

  const currentPage = pdfState?.page || currentPageState;
  const percentComplete = pdfState?.page && pdfState?.totalPages 
    ? Math.round((pdfState.page / pdfState.totalPages) * 100) 
    : percentCompleteState;

  // 4. Reading time counter & periodic heartbeat
  useEffect(() => {
    if (!resourceId) return;

    const syncProgressToServer = async (seconds) => {
      try {
        await apiClient.post(`/eresources/${resourceId}/progress`, {
          dailySecondsToday: seconds,
          readingTimeMinutes: Math.floor(seconds / 60),
        }).catch(() => {});
        lastSyncRef.current = seconds;
      } catch (e) {
        console.error('Failed to sync reading time:', e);
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
  };
};

export default useReaderPosition;
