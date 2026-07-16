import { useState, useEffect, useRef } from 'react';

// In-memory cache for book instances to prevent parsing the same book twice in the same session
const bookCache = new Map();

export const useEpubLoader = (url, viewerRef) => {
  const [rendition, setRendition] = useState(null);
  const [toc, setToc] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const bookRef = useRef(null);

  useEffect(() => {
    if (!url || !viewerRef.current) return;

    let active = true;
    setIsLoading(true);
    setError(null);

    const initEpub = async () => {
      try {
        // Dynamic import to lazy-load epubjs only when needed
        const { default: ePub } = await import('epubjs');

        if (!active) return;

        let book;
        if (bookCache.has(url)) {
          book = bookCache.get(url);
        } else {
          book = ePub(url);
          bookCache.set(url, book);
        }
        bookRef.current = book;

        // Load TOC navigation structure
        book.loaded.navigation
          .then((nav) => {
            if (active) {
              setToc(nav.toc || []);
            }
          })
          .catch((err) => {
            console.warn('Failed to parse navigation TOC:', err);
          });

        // Initialize Epub.js rendition
        const newRendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated', // standard page-by-page layout
        });

        if (active) {
          setRendition(newRendition);
        }

        // Trigger display and update loading status
        newRendition
          .display()
          .then(() => {
            if (active) {
              setIsLoading(false);
            }
          })
          .catch((err) => {
            console.error('Failed to display rendition:', err);
            if (active) {
              setError('Failed to display EPUB layout. The document content might be invalid.');
              setIsLoading(false);
            }
          });
      } catch (err) {
        console.error('Failed to load EPUB parsing engine:', err);
        if (active) {
          setError('Failed to initialize reader engine. The file might be corrupted or inaccessible.');
          setIsLoading(false);
        }
      }
    };

    initEpub();

    return () => {
      active = false;
      if (rendition) {
        try {
          rendition.destroy();
        } catch (e) {
          // ignore destroy errors on cleanup
        }
      }
    };
  }, [url]);

  return {
    book: bookRef.current,
    rendition,
    toc,
    isLoading,
    error,
  };
};
export default useEpubLoader;
