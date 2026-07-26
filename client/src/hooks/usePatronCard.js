import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../api/client";

const fetchProfile = async () => {
  const { data } = await apiClient.get("/auth/profile");
  return data.data; // student profile object
};

export const usePatronCard = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedData] = useState(() => {
    try {
      const cache = localStorage.getItem("bookbuddy_patron_card_cache");
      return cache ? JSON.parse(cache) : null;
    } catch {
      return null;
    }
  });

  // Monitor network connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // React Query to fetch profile details
  const {
    data: liveProfile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchProfile,
    enabled: isOnline,
    retry: 1,
  });

  // Fetch 30-second rotating token from backend
  const { data: tokenData } = useQuery({
    queryKey: ["patron-card-token"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/patron-card/token");
        return data.data;
      } catch {
        return null;
      }
    },
    enabled: isOnline,
    refetchInterval: 30000,
  });

  // Update offline cache in LocalStorage when live data is available
  useEffect(() => {
    if (liveProfile) {
      const newCache = {
        profile: liveProfile,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(
          "bookbuddy_patron_card_cache",
          JSON.stringify(newCache),
        );
      } catch (e) {
        console.error("Failed to save patron card cache", e);
      }
    }
  }, [liveProfile]);

  // Determine which profile data to display
  const activeProfile = liveProfile || cachedData?.profile || null;

  // Format cache date for display
  let cachedAtStr = "";
  if (cachedData?.timestamp) {
    cachedAtStr = new Date(cachedData.timestamp).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const defaultExpiresAt = tokenData?.expiresAt ? tokenData.expiresAt : null;

  return {
    profile: activeProfile,
    rotatingToken:
      tokenData?.token || activeProfile?.qrCodeData || activeProfile?.studentId,
    expiresAt: defaultExpiresAt,
    isLoading: isLoading && !activeProfile,
    isError: isError && !activeProfile,
    isOnline,
    cachedAt: cachedAtStr,
  };
};

export default usePatronCard;
