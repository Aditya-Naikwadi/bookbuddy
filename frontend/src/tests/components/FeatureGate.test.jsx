import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { FeatureGate } from "../../components/common/FeatureGate";
import { FeatureFlagContext } from "../../context/featureFlagContextObject";
import { PHASED_FEATURE_KEYS } from "@bookbuddy/shared";

describe("FeatureGate Route & Component Protection", () => {
  it("renders children when feature is enabled", () => {
    const mockContext = {
      enabledFeatures: ["offline-sync"],
      limits: {},
      isLoading: false,
      isError: false,
      isFeatureEnabled: (key) => key === "offline-sync",
      refetchFeatures: vi.fn(),
    };

    render(
      <FeatureFlagContext.Provider value={mockContext}>
        <FeatureGate feature="offline-sync">
          <div data-testid="protected-content">Sync Ready</div>
        </FeatureGate>
      </FeatureFlagContext.Provider>,
    );

    expect(screen.getByTestId("protected-content")).toBeDefined();
    expect(screen.getByText("Sync Ready")).toBeDefined();
  });

  it("renders null or fallback when feature is disabled without isPageGate", () => {
    const mockContext = {
      enabledFeatures: [],
      limits: {},
      isLoading: false,
      isError: false,
      isFeatureEnabled: () => false,
      refetchFeatures: vi.fn(),
    };

    render(
      <FeatureFlagContext.Provider value={mockContext}>
        <FeatureGate
          feature="offline-sync"
          fallback={<div>Alternative Feature</div>}
        >
          <div>Sync Ready</div>
        </FeatureGate>
      </FeatureFlagContext.Provider>,
    );

    expect(screen.queryByText("Sync Ready")).toBeNull();
    expect(screen.getByText("Alternative Feature")).toBeDefined();
  });

  it("renders FeatureUnavailablePage when isPageGate is true and feature is disabled", () => {
    const mockContext = {
      enabledFeatures: [],
      limits: {},
      isLoading: false,
      isError: false,
      isFeatureEnabled: () => false,
      refetchFeatures: vi.fn(),
    };

    render(
      <FeatureFlagContext.Provider value={mockContext}>
        <MemoryRouter>
          <FeatureGate feature="predictive-alerts" isPageGate>
            <div>Sensitive Analytics</div>
          </FeatureGate>
        </MemoryRouter>
      </FeatureFlagContext.Provider>,
    );

    expect(screen.queryByText("Sensitive Analytics")).toBeNull();
    expect(
      screen.getByText("Feature Not Available at Your Institution"),
    ).toBeDefined();
    expect(screen.getByText("Tenant Policy Enforced")).toBeDefined();
  });

  it("verifies all 10 phased feature keys are protected by FeatureGate", () => {
    const mockDisabledContext = {
      enabledFeatures: ["catalog"],
      limits: {},
      isLoading: false,
      isError: false,
      isFeatureEnabled: (key) => key === "catalog",
      refetchFeatures: vi.fn(),
    };

    for (const key of PHASED_FEATURE_KEYS) {
      const { unmount } = render(
        <FeatureFlagContext.Provider value={mockDisabledContext}>
          <MemoryRouter>
            <FeatureGate feature={key} isPageGate>
              <div>Secret {key}</div>
            </FeatureGate>
          </MemoryRouter>
        </FeatureFlagContext.Provider>,
      );

      expect(screen.queryByText(`Secret ${key}`)).toBeNull();
      expect(
        screen.getByText("Feature Not Available at Your Institution"),
      ).toBeDefined();
      unmount();
    }
  });
});
