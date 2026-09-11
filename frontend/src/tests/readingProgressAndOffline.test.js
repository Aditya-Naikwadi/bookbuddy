import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { useReadingProgress } from "../hooks/useReadingProgress";
import * as progressCache from "../lib/progressCache";
import { getLocalProgress, setLocalProgress } from "../lib/progressCache";
import {
  checkStorageQuota,
  isResourceDownloaded,
  getOfflineResource,
  getAllOfflineResources,
  deleteOfflineResource,
} from "../lib/downloadManager";
import apiClient from "../api/client";

const DB_NAME = "bookbuddy-offline-db";
const STORE_NAME = "offline-resources";

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

describe("Reading Progress and Offline Storage Consolidated Suite", () => {
  describe("useReadingProgress Hook (Debounced 4s, IDB Cache, Socket Sync)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
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

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      putSpy.mockClear();

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

      expect(putSpy).toHaveBeenCalledTimes(0);

      await act(async () => {
        vi.advanceTimersByTime(4000);
      });

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

      act(() => {
        unmount();
      });

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

  describe("F1.5 - IndexedDB progressCache Layer", () => {
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

  describe("F10.5 & F10.6 — downloadManager & Storage Quota Guard", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    describe("F10.6 — Storage Quota Guard", () => {
      it("Acceptance Criteria: blocks download and returns warning if projected usage exceeds quota", async () => {
        vi.stubGlobal("navigator", {
          storage: {
            estimate: async () => ({
              quota: 100 * 1024 * 1024,
              usage: 95 * 1024 * 1024,
            }),
          },
        });

        const result = await checkStorageQuota(10 * 1024 * 1024);
        expect(result.allowed).toBe(false);
        expect(result.warningMessage).toContain("Storage Quota Exceeded");
      });

      it("allows download when ample storage space is available", async () => {
        vi.stubGlobal("navigator", {
          storage: {
            estimate: async () => ({
              quota: 1000 * 1024 * 1024,
              usage: 10 * 1024 * 1024,
            }),
          },
        });

        const result = await checkStorageQuota(10 * 1024 * 1024);
        expect(result.allowed).toBe(true);
      });
    });

    describe("F10.5 — IndexedDB Offline Storage Helper API", () => {
      it("returns false for uncached resourceId", async () => {
        const isDL = await isResourceDownloaded("non-existent-res-id");
        expect(isDL).toBe(false);
      });

      it("returns null when getting offline resource that does not exist", async () => {
        const rec = await getOfflineResource("non-existent-res-id");
        expect(rec).toBeNull();
      });
    });
  });

  describe("Downloads Management Page Integration (F10.5 & F10.6)", () => {
    beforeEach(async () => {
      const db = await openDB(DB_NAME, 1, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        },
      });
      await db.clear(STORE_NAME);
    });

    it("retrieves stored offline items with individual file sizes", async () => {
      const db = await openDB(DB_NAME, 1);
      const mockBlob1 = new Blob(["sample pdf content 1"], {
        type: "application/pdf",
      });
      const mockBlob2 = new Blob(["sample epub content 2"], {
        type: "application/epub+zip",
      });

      await db.put(STORE_NAME, {
        id: "res-pdf-1",
        title: "Artificial Intelligence Basics",
        blob: mockBlob1,
        sizeBytes: mockBlob1.size,
        downloadedAt: Date.now(),
        mimeType: "application/pdf",
      });

      await db.put(STORE_NAME, {
        id: "res-epub-2",
        title: "Data Structures and Algorithms",
        blob: mockBlob2,
        sizeBytes: mockBlob2.size,
        downloadedAt: Date.now(),
        mimeType: "application/epub+zip",
      });

      const items = await getAllOfflineResources();
      expect(items.length).toBe(2);

      const titles = items.map((i) => i.title);
      expect(titles).toContain("Artificial Intelligence Basics");
      expect(titles).toContain("Data Structures and Algorithms");

      const totalBytes = items.reduce((acc, curr) => acc + curr.sizeBytes, 0);
      expect(totalBytes).toBe(mockBlob1.size + mockBlob2.size);
    });

    it("Acceptance Criteria: deleting an item frees storage estimate and item no longer opens offline", async () => {
      const db = await openDB(DB_NAME, 1);
      const mockBlob = new Blob(["large ebook binary data stream"], {
        type: "application/pdf",
      });

      await db.put(STORE_NAME, {
        id: "res-to-delete",
        title: "Operating System Concepts",
        blob: mockBlob,
        sizeBytes: mockBlob.size,
        downloadedAt: Date.now(),
      });

      let isDL = await isResourceDownloaded("res-to-delete");
      expect(isDL).toBe(true);

      let items = await getAllOfflineResources();
      expect(items.length).toBe(1);
      expect(items[0].sizeBytes).toBe(mockBlob.size);

      await deleteOfflineResource("res-to-delete");

      isDL = await isResourceDownloaded("res-to-delete");
      expect(isDL).toBe(false);

      items = await getAllOfflineResources();
      expect(items.length).toBe(0);
    });
  });
});
