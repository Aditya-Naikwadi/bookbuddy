import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ePub from 'epubjs';
import { ArrowLeft, Settings, Loader2 } from 'lucide-react';
import { getContentUrl } from '../../../api/eresourcesApi';

const EbookReader = () => {
  const { resourceId } = useParams();
  const navigate = useNavigate();
  const [format, setFormat] = useState('epub'); // Default to trying epub first
  const [isLoading, setIsLoading] = useState(true);
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);

  useEffect(() => {
    let book;
    if (format === 'epub' && viewerRef.current) {
      const url = getContentUrl(resourceId, 'epub');
      
      book = ePub(url);
      const rendition = book.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none',
      });
      
      renditionRef.current = rendition;

      rendition.display().then(() => {
        setIsLoading(false);
      }).catch(err => {
        console.error('Failed to load EPUB:', err);
        // Fallback to HTML if EPUB fails
        setFormat('html');
      });

      // Handle keyboard navigation
      const keyListener = (e) => {
        if ((e.keyCode || e.which) === 37) rendition.prev();
        if ((e.keyCode || e.which) === 39) rendition.next();
      };
      rendition.on('keyup', keyListener);
      document.addEventListener('keyup', keyListener);

      return () => {
        document.removeEventListener('keyup', keyListener);
        book.destroy();
      };
    } else if (format === 'html') {
      setIsLoading(false); // HTML iframe handles its own loading state basically
    }
  }, [resourceId, format]);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Reader Topbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Reader Content Area */}
      <div className="flex-1 relative overflow-hidden flex justify-center bg-[#fdfcf8]">
        {isLoading && format === 'epub' && (
          <div className="absolute inset-0 flex flex-col justify-center items-center bg-[#fdfcf8] z-20">
            <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
            <p className="text-slate-500 font-medium tracking-wide">Loading your book...</p>
          </div>
        )}
        
        {format === 'epub' ? (
          <div className="w-full max-w-4xl h-full relative group">
            {/* Prev/Next overlay buttons for mouse users */}
            <button 
              onClick={() => renditionRef.current?.prev()} 
              className="absolute left-0 top-0 bottom-0 w-16 z-10 opacity-0 group-hover:opacity-100 hover:bg-black/5 transition-all"
            />
            <div ref={viewerRef} className="w-full h-full p-8" />
            <button 
              onClick={() => renditionRef.current?.next()} 
              className="absolute right-0 top-0 bottom-0 w-16 z-10 opacity-0 group-hover:opacity-100 hover:bg-black/5 transition-all"
            />
          </div>
        ) : (
          <iframe 
            src={getContentUrl(resourceId, 'html')} 
            className="w-full max-w-4xl h-full bg-white shadow-xl border-x border-slate-200"
            title="HTML Book Reader"
          />
        )}
      </div>
    </div>
  );
};

export default EbookReader;
