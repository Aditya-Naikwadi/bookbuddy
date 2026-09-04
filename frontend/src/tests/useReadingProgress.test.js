import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "fake-indexeddb/auto";
import { useReadingProgress } from "../hooks/useReadingProgress";
import * as progressCache from "../lib/progressCache";
import apiClient from "../api/client";

// Mock socket.io hook
const mockSocketOn = vi.fn();
const mockSocketOff = vi.fn();
vi.mock("../hooks/useSocket", () => {
  const mockHook = () => ({
    socket: {
      on: mockSocketOn,
      off: mockSocketOff,
    },
    isConnected: true,
  });
  return {
    useSocket: mockHook,
    default: mockHook,
  };
});

describe("useReadingProgress Hook (Debounced 4s, IDB Cache, Socket Sync)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Acceptance Criteria: 10 rapid page turns within 2 seconds results in exactly 1 server PUT call", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { success: true, data: null },
    });
    const putSpy = vi.spyOn(apiClient, "put").mockResolvedValue({
      data: { success: true, data: {} },
    });

    const resourceId = "res-rapid-turn-test";
    const { result } = renderHook(() => useReadingProgress(resourceId));

    // Wait for mount async load
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    putSpy.mockClear();

    // Turn 10 pages rapidly over 2 seconds (1 page turn every 200ms)
    for (let i = 1; i <= 10; i++) {
      act(() => {
        result.current.saveProgress({
          position: { page: i },
          percentageComplete: i * 10,
        });
      });
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
    }

    // At 2 seconds (10 turns), 4-second debounce timer has not expired yet
    expect(putSpy).toHaveBeenCalledTimes(0);

    // Fast-forward remaining 4 seconds of inactivity
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    // Exactly 1 server PUT call should be made with the latest page (page 10)
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(putSpy).toHaveBeenCalledWith(
      `/reading-progress/${resourceId}`,
      expect.objectContaining({
        resourceId,
        position: { page: 10 },
        percentageComplete: 100,
      }),
    );
  });

  it("Writes to local IndexedDB cache immediately on each tick", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { success: true, data: null },
    });
    vi.spyOn(apiClient, "put").mockResolvedValue({
      data: { success: true, data: {} },
    });
    const setCacheSpy = vi.spyOn(progressCache, "setLocalProgress");

    const resourceId = "res-idb-tick-test";
    const { result } = renderHook(() => useReadingProgress(resourceId));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    setCacheSpy.mockClear();

    act(() => {
      result.current.saveProgress({
        position: { page: 5 },
        percentageComplete: 50,
      });
    });

    // Local IndexedDB cache write should happen immediately on tick
    expect(setCacheSpy).toHaveBeenCalledWith(
      resourceId,
      expect.objectContaining({
        resourceId,
        position: { page: 5 },
        percentageComplete: 50,
      }),
    );
  });

  it("Force-flushes pending server PUT on unmount", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { success: true, data: null },
    });
    const putSpy = vi
      .spyOn(apiClient, "put")
      .mockResolvedValue({ data: { success: true, data: {} } });

    const resourceId = "res-flush-unmount-test";
    const { result, unmount } = renderHook(() =>
      useReadingProgress(resourceId),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    putSpy.mockClear();

    act(() => {
      result.current.saveProgress({
        position: { page: 7 },
        percentageComplete: 70,
      });
    });

    expect(putSpy).toHaveBeenCalledTimes(0);

    // Unmount hook before 4s timer finishes
    act(() => {
      unmount();
    });

    // Unmount forces flush of debounced write
    expect(putSpy).toHaveBeenCalledTimes(1);
  });

  it("F1.7: Sets discrepancy when local and server positions disagree on open", async () => {
    const resourceId = "res-discrepancy-test";
    const localData = {
      resourceId,
      position: { page: 2 },
      percentageComplete: 20,
    };
    const serverData = {
      resourceId,
      position: { page: 42 },
      percentageComplete: 84,
    };

    vi.spyOn(progressCache, "getLocalProgress").mockResolvedValue(localData);
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { success: true, data: serverData },
    });

    const { result } = renderHook(() => useReadingProgress(resourceId));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.discrepancy).not.toBeNull();
    expect(result.current.discrepancy.local).toEqual(localData);
    expect(result.current.discrepancy.server).toEqual(serverData);
  });

  it("F1.7: Listens to Socket.io progress:updated events and triggers remote update callback", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { success: true, data: null },
    });

    const resourceId = "res-socket-sync-test";
    const onRemotePositionUpdate = vi.fn();

    renderHook(() =>
      useReadingProgress(resourceId, { onRemotePositionUpdate }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockSocketOn).toHaveBeenCalledWith(
      "progress:updated",
      expect.any(Function),
    );

    const socketCallback = mockSocketOn.mock.calls.find(
      (call) => call[0] === "progress:updated",
    )[1];

    // Simulate incoming socket event from another tab
    act(() => {
      socketCallback({
        resourceId,
        position: { page: 99 },
        percentageComplete: 99,
      });
    });

    expect(onRemotePositionUpdate).toHaveBeenCalledWith({
      resourceId,
      position: { page: 99 },
      percentageComplete: 99,
    });
  });
});
