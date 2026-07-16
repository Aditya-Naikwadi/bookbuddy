import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

const fetchProfile = async () => {
  const { data } = await apiClient.get('/auth/profile');
  return data.data; // student profile object
};

export const usePatronCard = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedData, setCachedData] = useState(null);

  // Monitor network connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load of cached data from localStorage
    try {
      const cache = localStorage.getItem('bookbuddy_patron_card_cache');
      if (cache) {
        setCachedData(JSON.parse(cache));
      }
    } catch (e) {
      console.error('Failed to parse patron card cache', e);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // React Query to fetch profile details
  const { data: liveProfile, isLoading, isError } = useQuery({
    queryKey: ['user-profile'],
    queryFn: fetchProfile,
    enabled: isOnline, // Only fetch if we are online
    retry: 1,
  });

  // Update offline cache when live data is successfully fetched
  useEffect(() => {
    if (liveProfile) {
      const newCache = {
        profile: liveProfile,
        timestamp: Date.now(),
      };
      setCachedData(newCache);
      try {
        localStorage.setItem('bookbuddy_patron_card_cache', JSON.stringify(newCache));
      } catch (e) {
        console.error('Failed to save patron card cache', e);
      }
    }
  }, [liveProfile]);

  // Determine which profile data to display
  // If we are online and have live data, use it; otherwise fall back to cache
  const activeProfile = liveProfile || cachedData?.profile || null;

  // Format cache date for display
  let cachedAtStr = '';
  if (cachedData?.timestamp) {
    cachedAtStr = new Date(cachedData.timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return {
    profile: activeProfile,
    isLoading: isLoading && !activeProfile, // Only show loading if there is no cache fallback available
    isError: isError && !activeProfile, // Only show error if there is no cache fallback
    isOnline,
    cachedAt: cachedAtStr,
  };
};
