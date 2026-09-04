import React, { useState, useRef, useEffect, useCallback } from "react";

const VirtualizedCardGrid = ({
  items = [],
  renderItem,
  loading = false,
  emptyState,
  viewMode = "grid",
  columns = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  estimatedItemHeight = 220,
}) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  const handleScroll = useCallback((e) => {
    const target = e.target;
    requestAnimationFrame(() => {
      setScrollTop(target.scrollTop);
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight || 600);

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height || 600);
        }
      });
      resizeObserver.observe(el);
      return () => resizeObserver.disconnect();
    }
  }, []);

  if (loading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div
          className={`grid ${viewMode === "list" ? "grid-cols-1" : columns} gap-4`}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm animate-pulse space-y-3"
            >
              <div className="flex justify-between">
                <div className="w-10 h-10 bg-slate-800 rounded-xl"></div>
                <div className="w-20 h-4 bg-slate-800 rounded-md"></div>
              </div>
              <div className="h-4 w-3/4 bg-slate-800 rounded-md"></div>
              <div className="h-3 w-1/2 bg-slate-800 rounded-md"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-4">
        {emptyState}
      </div>
    );
  }

  // Virtualization calculations for large lists (> 12 items)
  const isLargeList = items.length > 12;
  const numColumns = viewMode === "list" ? 1 : 3;
  const totalRows = Math.ceil(items.length / numColumns);

  let visibleItems = items;
  let paddingTop = 0;
  let paddingBottom = 0;

  if (isLargeList) {
    const bufferRows = 2;
    const startRow = Math.max(
      0,
      Math.floor(scrollTop / estimatedItemHeight) - bufferRows,
    );
    const visibleRowCount =
      Math.ceil(containerHeight / estimatedItemHeight) + bufferRows * 2;
    const endRow = Math.min(totalRows, startRow + visibleRowCount);

    const startIndex = startRow * numColumns;
    const endIndex = Math.min(items.length, endRow * numColumns);

    visibleItems = items.slice(startIndex, endIndex);
    paddingTop = startRow * estimatedItemHeight;
    paddingBottom = Math.max(0, (totalRows - endRow) * estimatedItemHeight);
  }

  return (
    <div
      ref={containerRef}
      onScroll={isLargeList ? handleScroll : undefined}
      className="flex-1 min-h-0 overflow-y-auto pr-1.5 scrollbar-thin"
    >
      <div
        style={{
          paddingTop: `${paddingTop}px`,
          paddingBottom: `${paddingBottom}px`,
        }}
      >
        <div
          className={`grid ${viewMode === "list" ? "grid-cols-1" : columns} gap-4 pb-4`}
        >
          {visibleItems.map((item, index) =>
            renderItem(
              item,
              isLargeList
                ? Math.floor(scrollTop / estimatedItemHeight) * numColumns +
                    index
                : index,
            ),
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(VirtualizedCardGrid);
