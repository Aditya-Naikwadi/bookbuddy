import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';

export const useReaderPosition = (resourceId, userId, rendition) => {
  const [currentCfi, setCurrentCfi] = useState(null);
  const [percentComplete, setPercentComplete] = useState(0);
  const [readingTimeSeconds, setReadingTimeSeconds] = useState(0);

  const secondsRef = useRef(0);
  const lastSyncRef = useRef(0);
  const localKey = `bookbuddy_position_${userId}_${resourceId}`;

  // 1. Restore last saved position once rendition is ready
  useEffect(() => {
    if (!rendition) return;

    try {
      const saved = localStorage.getItem(localKey);
      if (saved) {
        const { cfi } = JSON.parse(saved);
        if (cfi) {
          rendition.display(cfi);
        }
      }
    } catch (e) {
      console.error('Failed to load saved position from cache:', e);
    }
  }, [rendition, localKey]);

  // 2. Track reading position changes (relocated)
  useEffect(() => {
    if (!rendition) return;

    const handleRelocate = (location) => {
      const cfi = location.start.cfi;
      const percent = Math.round((location.start.percentage || 0) * 100);

      setCurrentCfi(cfi);
      setPercentComplete(percent);

      try {
        localStorage.setItem(
          localKey,
          JSON.stringify({ cfi, percent, timestamp: Date.now() })
        );
      } catch (e) {
        console.error('Failed to save position to cache:', e);
      }
    };

    rendition.on('relocated', handleRelocate);
    return () => {
      rendition.off('relocated', handleRelocate);
    };
  }, [rendition, localKey]);

  // 3. Track reading progress timer & sync to server
  useEffect(() => {
    if (!resourceId) return;

    // Heartbeat sync helper
    const syncProgressToServer = async (seconds) => {
      try {
        await apiClient.post(`/eresources/${resourceId}/progress`, {
          dailySecondsToday: seconds,
          readingTimeMinutes: Math.floor(seconds / 60),
        });
        lastSyncRef.current = seconds;
      } catch (e) {
        console.error('Failed to sync reading progress to server:', e);
      }
    };

    // Incremental timer loop
    const timer = setInterval(() => {
      secondsRef.current += 1;
      setReadingTimeSeconds(secondsRef.current);

      // Heartbeat sync every 30 seconds
      if (secondsRef.current - lastSyncRef.current >= 30) {
        syncProgressToServer(secondsRef.current);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      // Final sync on exit if there is unsynced time
      if (secondsRef.current > lastSyncRef.current) {
        syncProgressToServer(secondsRef.current);
      }
    };
  }, [resourceId]);

  return {
    currentCfi,
    percentComplete,
    readingTimeSeconds,
  };
};

export default useReaderPosition;
