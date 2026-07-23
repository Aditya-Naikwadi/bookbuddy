import { useContext } from 'react';
import { FeatureFlagContext } from '../context/featureFlagContextObject';

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

export default useFeatureFlags;
