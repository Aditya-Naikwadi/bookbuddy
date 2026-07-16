import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import apiClient from '../../../api/client';
import useAuthStore from '../../../store/authStore';
import { getContentUrl } from '../../../api/eresourcesApi';
import { useEpubLoader } from '../../../hooks/useEpubLoader';
import { useReaderPosition } from '../../../hooks/useReaderPosition';
import { ReaderToolbar } from '../../../components/student/ebook-reader/ReaderToolbar';
import { TableOfContents } from '../../../components/student/ebook-reader/TableOfContents';
import { ReaderThemeControls } from '../../../components/student/ebook-reader/ReaderThemeControls';

const EbookReader = () => {
  const { resourceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id || user?._id || 'guest';

  const viewerRef = useRef(null);
  const readerContainerRef = useRef(null);

  // States
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Persistent Settings
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem(`bookbuddy_reader_fontsize_${userId}`);
    return saved ? parseInt(saved, 10) : 100;
  });
  const [activeTheme, setActiveTheme] = useState(() => {
    const saved = localStorage.getItem(`bookbuddy_reader_theme_${userId}`);
    return saved || 'light';
  });

  // 1. Fetch metadata details of EResource
  const { data: resource, isLoading: loadingMeta, isError: errorMeta } = useQuery({
    queryKey: ['e-resource-detail', resourceId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/dashboards/student/eresources/${resourceId}`);
      return data.data;
    },
    retry: 1,
  });

  // Determine actual resource source URL
  const isGutenberg = resource?.source === 'gutenberg';
  const fileUrl = isGutenberg ? getContentUrl(resourceId, 'epub') : resource?.fileUrl;

  // 2. Load EPUB using lazy-loaded hook
  const { rendition, toc, isLoading: loadingEpub, error: loaderError } = useEpubLoader(
    resource?.type === 'pdf' ? null : fileUrl, // Only render EPUBs in epubjs
    viewerRef
  );

  // 3. Track CFI position and accumulate reading time progress
  const { percentComplete } = useReaderPosition(resourceId, userId, rendition);

  // Apply style options (themes + font size) to rendition
  useEffect(() => {
    if (!rendition) return;

    // Define themes in epubjs frame environment
    const themes = {
      light: {
        body: {
          background: '#fdfcf8 !important',
          color: '#0f172a !important',
          'font-family': 'Georgia, serif !important',
          'line-height': '1.65 !important',
        },
      },
      sepia: {
        body: {
          background: '#f4ecd8 !important',
          color: '#433422 !important',
          'font-family': 'Georgia, serif !important',
          'line-height': '1.65 !important',
        },
      },
      dark: {
        body: {
          background: '#0f172a !important',
          color: '#f8fafc !important',
          'font-family': 'Georgia, serif !important',
          'line-height': '1.65 !important',
        },
      },
      'high-contrast': {
        body: {
          background: '#000000 !important',
          color: '#facc15 !important', // bright yellow
          'font-family': 'Georgia, serif !important',
          'line-height': '1.65 !important',
          'font-weight': 'bold !important',
        },
      },
    };

    // Register all custom themes
    Object.keys(themes).forEach((name) => {
      rendition.themes.register(name, themes[name]);
    });

    // Select theme & font size
    rendition.themes.select(activeTheme);
    rendition.themes.fontSize(`${fontSize}%`);
  }, [rendition, activeTheme, fontSize]);

  // Handle setting updates
  const handleThemeChange = (theme) => {
    setActiveTheme(theme);
    localStorage.setItem(`bookbuddy_reader_theme_${userId}`, theme);
  };

  const handleFontSizeChange = (size) => {
    setFontSize(size);
    localStorage.setItem(`bookbuddy_reader_fontsize_${userId}`, size);
  };

  // Keyboard navigation & Focus trapping
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        else if (tocOpen) setTocOpen(false);
        else navigate(-1); // Close reader
      }

      if (e.key === 'ArrowLeft' && rendition) {
        rendition.prev();
      }
      if (e.key === 'ArrowRight' && rendition) {
        rendition.next();
      }
      if (e.key === 'Tab') {
        handleFocusTrap(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [rendition, settingsOpen, tocOpen]);

  // Trap focus inside reader controls
  const handleFocusTrap = (e) => {
    if (!readerContainerRef.current) return;
    const focusable = Array.from(
      readerContainerRef.current.querySelectorAll(
        'button, [href], [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  };

  // Exit helper
  const handleExit = () => {
    navigate(-1);
  };

  const isError = errorMeta || loaderError;
  const isLoading = loadingMeta || loadingEpub;

  // Background style classes depending on theme
  const getThemeBgClass = () => {
    switch (activeTheme) {
      case 'sepia':
        return 'bg-[#f4ecd8] text-[#433422]';
      case 'dark':
        return 'bg-[#0f172a] text-slate-100';
      case 'high-contrast':
        return 'bg-black text-yellow-400';
      default:
        return 'bg-[#fdfcf8] text-slate-900';
    }
  };

  return (
    <div
      ref={readerContainerRef}
      className={`fixed inset-0 z-50 flex flex-col h-screen w-screen overflow-hidden select-none outline-none ${getThemeBgClass()}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Ebook Reader: ${resource?.title || 'Loading book'}`}
    >
      {/* 1. Loading Overlay state */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col justify-center items-center z-50 bg-inherit transition-all duration-300">
          <Loader2 className="animate-spin text-indigo mb-4" size={44} />
          <h2 className="font-serif font-bold text-lg sm:text-xl text-center">
            {resource?.title ? `Opening "${resource.title}"...` : 'Opening your ebook...'}
          </h2>
          <p className="text-xs text-muted mt-2 tracking-wide">Lazy-loading reader engine & parsing content</p>
        </div>
      )}

      {/* 2. Error State */}
      {isError && (
        <div className="absolute inset-0 flex flex-col justify-center items-center z-50 bg-slate-900 text-white p-6 text-center">
          <div className="p-3 bg-red-500/10 rounded-full text-red-500 mb-4">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-xl font-bold font-serif">Failed to load E-Book</h2>
          <p className="text-sm text-slate-400 max-w-sm mt-2 leading-relaxed">
            {loaderError || 'The catalog e-book could not be retrieved from Gutenberg. Please verify your connection.'}
          </p>
          <button
            onClick={handleExit}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-indigo text-white font-bold rounded-xl hover:bg-indigo-600 transition-all text-xs"
          >
            <ArrowLeft size={16} />
            Return to Dashboard
          </button>
        </div>
      )}

      {/* 3. Toolbar navigation */}
      {!isLoading && !isError && (
        <ReaderToolbar
          title={resource?.title}
          author={resource?.author}
          percentComplete={percentComplete}
          onToggleToc={() => {
            setTocOpen(!tocOpen);
            setSettingsOpen(false);
          }}
          onToggleSettings={() => {
            setSettingsOpen(!settingsOpen);
            setTocOpen(false);
          }}
          onPrevPage={() => rendition?.prev()}
          onNextPage={() => rendition?.next()}
          onClose={handleExit}
          settingsOpen={settingsOpen}
          tocOpen={tocOpen}
        />
      )}

      {/* Main viewport block */}
      <div className="flex-1 relative flex overflow-hidden w-full pt-16">
        {/* Table of Contents Sidebar */}
        {tocOpen && (
          <div className="absolute left-0 top-0 bottom-0 z-30 h-full shrink-0">
            <TableOfContents
              toc={toc}
              onJumpToLocation={(loc) => rendition?.display(loc)}
              onClose={() => setTocOpen(false)}
            />
          </div>
        )}

        {/* Content reader frame */}
        <div className="flex-1 h-full flex justify-center items-center relative z-10">
          {/* Settings Panel Overlay popup */}
          {settingsOpen && (
            <div className="absolute right-4 top-4 z-40 animate-in fade-in zoom-in-95 duration-200">
              <ReaderThemeControls
                fontSize={fontSize}
                onChangeFontSize={handleFontSizeChange}
                activeTheme={activeTheme}
                onChangeTheme={handleThemeChange}
              />
            </div>
          )}

          {/* Left/Right swipe margins for touchscreen clicks */}
          <button
            onClick={() => rendition?.prev()}
            className="absolute left-0 top-16 bottom-16 w-12 sm:w-20 z-20 flex items-center justify-start pl-3 opacity-0 hover:opacity-10 hover:bg-black/5 active:bg-black/10 text-slate-800 transition-all cursor-west-resize"
            aria-label="Previous page edge tap"
          >
            <ChevronLeft size={36} />
          </button>

          {/* Reading Document Container */}
          <div 
            ref={viewerRef} 
            className="w-full max-w-3xl h-full p-4 sm:p-12 overflow-hidden shadow-inner bg-transparent"
          />

          <button
            onClick={() => rendition?.next()}
            className="absolute right-0 top-16 bottom-16 w-12 sm:w-20 z-20 flex items-center justify-end pr-3 opacity-0 hover:opacity-10 hover:bg-black/5 active:bg-black/10 text-slate-800 transition-all cursor-east-resize"
            aria-label="Next page edge tap"
          >
            <ChevronRight size={36} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EbookReader;
