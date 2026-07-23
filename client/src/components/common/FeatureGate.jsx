import React from 'react';
import { useFeatureFlags } from '../../context/FeatureFlagContext';
import FeatureUnavailablePage from '../../pages/public/FeatureUnavailablePage';

export function FeatureGate({ feature, fallback = null, isPageGate = false, children }) {
  const { isFeatureEnabled } = useFeatureFlags();

  if (!feature) {
    return <>{children}</>;
  }

  const featuresToCheck = Array.isArray(feature) ? feature : [feature];
  const isEnabled = featuresToCheck.every((key) => isFeatureEnabled(key));

  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (isPageGate) {
    return <FeatureUnavailablePage featureKey={featuresToCheck.join(', ')} />;
  }

  return null;
}

export default FeatureGate;
