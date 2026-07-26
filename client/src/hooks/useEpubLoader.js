import { useState, useEffect } from "react";

// In-memory cache for book instances to prevent parsing the same book twice in the same session
const bookCache = new Map();

export const useEpubLoader = (url, viewerRef) => {
  const [book, setBook] = useState(null);
  const [rendition, setRendition] = useState(null);
  const [toc, setToc] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url || !viewerRef.current) return;

    let active = true;

    const initEpub = async () => {
      try {
        const { default: ePub } = await import("epubjs");

        if (!active) return;

        let loadedBook;
        if (bookCache.has(url)) {
          loadedBook = bookCache.get(url);
        } else {
          loadedBook = ePub(url);
          bookCache.set(url, loadedBook);
        }

        if (active) {
          setBook(loadedBook);
        }

        // Load TOC navigation structure
        loadedBook.loaded.navigation
          .then((nav) => {
            if (active) {
              setToc(nav.toc || []);
            }
          })
          .catch((err) => {
            console.warn("Failed to parse navigation TOC:", err);
          });

        // Initialize Epub.js rendition
        const newRendition = loadedBook.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          spread: "none",
          flow: "paginated",
        });

        if (active) {
          setRendition(newRendition);
        }

        newRendition
          .display()
          .then(() => {
            if (active) {
              setIsLoading(false);
            }
          })
          .catch((err) => {
            console.error("Failed to display rendition:", err);
            if (active) {
              setError(
                "Failed to display EPUB layout. The document content might be invalid.",
              );
              setIsLoading(false);
            }
          });
      } catch (err) {
        console.error("Failed to load EPUB parsing engine:", err);
        if (active) {
          setError(
            "Failed to initialize reader engine. The file might be corrupted or inaccessible.",
          );
          setIsLoading(false);
        }
      }
    };

    initEpub();

    return () => {
      active = false;
    };
  }, [url, viewerRef]);

  return {
    book,
    rendition,
    toc,
    isLoading,
    error,
  };
};

export default useEpubLoader;
