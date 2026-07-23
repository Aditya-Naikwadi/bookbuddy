import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../store/authStore';
import featureApi from '../api/featureApi';
import { FeatureFlagContext, DEFAULT_CORE_FEATURES } from './featureFlagContextObject';

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
    staleTime: 1000 * 60 * 15,
    cacheTime: 1000 * 60 * 30,
  });

  const enabledFeatures = useMemo(() => {
    if (data?.enabledFeatures && Array.isArray(data.enabledFeatures)) {
      return data.enabledFeatures;
    }
    return DEFAULT_CORE_FEATURES;
  }, [data]);

  const limits = useMemo(() => data?.limits || {}, [data]);

  const isFeatureEnabled = useCallback(
    (key) => {
      if (!key) return true;
      if (DEFAULT_CORE_FEATURES.includes(key)) return true;
      if (user?.role === 'super-admin') return true;
      return enabledFeatures.includes(key);
    },
    [user?.role, enabledFeatures]
  );

  const value = useMemo(
    () => ({
      enabledFeatures,
      limits,
      isLoading,
      isError,
      isFeatureEnabled,
      refetchFeatures,
    }),
    [enabledFeatures, limits, isLoading, isError, isFeatureEnabled, refetchFeatures]
  );

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export default FeatureFlagProvider;
