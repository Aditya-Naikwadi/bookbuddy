import { createContext } from "react";

export const DEFAULT_CORE_FEATURES = ["catalog", "loans", "patron-card"];

export const FeatureFlagContext = createContext({
  enabledFeatures: DEFAULT_CORE_FEATURES,
  limits: {},
  isLoading: false,
  isError: false,
  isFeatureEnabled: () => true,
  refetchFeatures: () => {},
});

export default FeatureFlagContext;
