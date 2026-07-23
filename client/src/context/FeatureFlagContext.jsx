import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../store/authStore';
import featureApi from '../api/featureApi';

const DEFAULT_CORE_FEATURES = ['catalog', 'loans', 'patron-card'];

const FeatureFlagContext = createContext({
  enabledFeatures: DEFAULT_CORE_FEATURES,
  limits: {},
  isLoading: false,
  isError: false,
  isFeatureEnabled: () => true,
  refetchFeatures: () => {},
});

export function FeatureFlagProvider({ children }) {
  const { user } = useAuthStore();
  const collegeId = user?.collegeId || 'current';

  const {
    data,
    isLoading,
    isError,
    refetch: refetchFeatures,
  } = useQuery({
    queryKey: ['collegeFeatures', collegeId, user?.role],
    queryFn: () => featureApi.getCollegeFeatures(collegeId),
    enabled: !!user,
    staleTime: 1000 * 60 * 15, // 15 mins caching
    cacheTime: 1000 * 60 * 30,
  });

  const enabledFeatures = useMemo(() => {
    if (data?.enabledFeatures && Array.isArray(data.enabledFeatures)) {
      return data.enabledFeatures;
    }
    // Fall back to default core features if not yet loaded or errored
    return DEFAULT_CORE_FEATURES;
  }, [data]);

  const limits = useMemo(() => data?.limits || {}, [data]);

  const isFeatureEnabled = (key) => {
    if (!key) return true;
    // Core features are always enabled
    if (DEFAULT_CORE_FEATURES.includes(key)) return true;
    // Super admins see all features
    if (user?.role === 'super-admin') return true;
    return enabledFeatures.includes(key);
  };

  const value = useMemo(
    () => ({
      enabledFeatures,
      limits,
      isLoading,
      isError,
      isFeatureEnabled,
      refetchFeatures,
    }),
    [enabledFeatures, limits, isLoading, isError]
  );

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
}

export function useFeature(key) {
  const { isFeatureEnabled, isLoading } = useFeatureFlags();
  return {
    isEnabled: isFeatureEnabled(key),
    isLoading,
  };
}

export default FeatureFlagContext;
