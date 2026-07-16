import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { facilitiesApi } from '../api/facilitiesApi';

export const useAvailability = (labName, dateStr) => {
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Monitor visibilityState to pause/resume polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const {
    data = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['lab-availability', labName, dateStr],
    queryFn: () => facilitiesApi.getAvailability(labName, dateStr),
    enabled: !!labName && !!dateStr,
    // Poll every 20 seconds only if the tab is visible
    refetchInterval: isTabVisible ? 20000 : false,
    staleTime: 10000, // Stale after 10s
  });

  return {
    availability: data,
    isLoading,
    isRefetching,
    error,
    refetch,
    isPollingActive: isTabVisible,
  };
};

export default useAvailability;
