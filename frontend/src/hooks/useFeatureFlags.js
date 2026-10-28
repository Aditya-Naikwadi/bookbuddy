import { useContext } from "react";
import { FeatureFlagContext } from "../context/featureFlagContextObject";

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    return {
      enabledFeatures: [],
      limits: {},
      isLoading: false,
      isError: false,
      isFeatureEnabled: () => true,
      refetchFeatures: () => {},
    };
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
