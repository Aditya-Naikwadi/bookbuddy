import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { getLocalProgress, setLocalProgress } from "../lib/progressCache";

describe("F1.5 - IndexedDB progressCache Layer", () => {
  beforeEach(() => {
    // reset IndexedDB state between tests if needed
  });

  it("returns null for uncached resourceId", async () => {
    const progress = await getLocalProgress("non-existent-resource-id");
    expect(progress).toBeNull();
  });

  it("persists and retrieves progress data via setLocalProgress and getLocalProgress", async () => {
    const resourceId = "res-101";
    const testData = {
      position: { page: 42, cfi: "epubcfi(/6/4)" },
      percentageComplete: 65,
      updatedAt: new Date().toISOString(),
    };

    await setLocalProgress(resourceId, testData);

    const cached = await getLocalProgress(resourceId);
    expect(cached).not.toBeNull();
    expect(cached.resourceId).toBe("res-101");
    expect(cached.position).toEqual({ page: 42, cfi: "epubcfi(/6/4)" });
    expect(cached.percentageComplete).toBe(65);
  });

  it("updates existing cached progress data for the same resourceId", async () => {
    const resourceId = "res-102";
    await setLocalProgress(resourceId, {
      percentageComplete: 10,
      position: { page: 1 },
    });
    await setLocalProgress(resourceId, {
      percentageComplete: 90,
      position: { page: 25 },
    });

    const cached = await getLocalProgress(resourceId);
    expect(cached.percentageComplete).toBe(90);
    expect(cached.position.page).toBe(25);
  });
});
