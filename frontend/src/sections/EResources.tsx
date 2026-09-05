import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, BookOpen, Download, Sparkles } from "lucide-react";
import { SectionLabel } from "../components/ui/SectionLabel";
import { Button } from "../components/ui/Button";
import { BookCoverImage } from "../components/common/BookCoverImage";
import { motion } from "framer-motion";
import useAuthStore from "../store/authStore";

interface EResourceBook {
  id: string;
  title: string;
  author: string;
  genre: string;
  format: string;
  coverImage?: string;
}

const ERESOURCE_BOOKS: EResourceBook[] = [
  {
    id: "eb-1",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    genre: "Classic Fiction",
    format: "EPUB / PDF",
    coverImage: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80",
  },
  {
    id: "eb-2",
    title: "Frankenstein; Or, The Modern Prometheus",
    author: "Mary Shelley",
    genre: "Gothic Horror",
    format: "EPUB / PDF",
    coverImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80",
  },
  {
    id: "eb-3",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    genre: "American Literature",
    format: "EPUB / PDF",
    coverImage: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80",
  },
  {
    id: "eb-4",
    title: "The Adventures of Sherlock Holmes",
    author: "Arthur Conan Doyle",
    genre: "Mystery & Detective",
    format: "EPUB / PDF",
    coverImage: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=400&q=80",
  },
  {
    id: "eb-5",
    title: "The Time Machine",
    author: "H.G. Wells",
    genre: "Science Fiction",
    format: "EPUB / PDF",
    coverImage: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&q=80",
  },
  {
    id: "eb-6",
    title: "Dracula",
    author: "Bram Stoker",
    genre: "Horror / Gothic",
    format: "EPUB / PDF",
    coverImage: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400&q=80",
  },
  {
    id: "eb-7",
    title: "The Metamorphosis",
    author: "Franz Kafka",
    genre: "Modernist Fiction",
    format: "EPUB / PDF",
    coverImage: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&q=80",
  },
];

export const EResources = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = 320;
      carouselRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleBrowseLibrary = () => {
    const catalogSection =
      document.getElementById("catalog-search") ||
      document.getElementById("library") ||
      document.querySelector('[data-section="catalog-search"]');
    if (catalogSection) {
      catalogSection.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/auth/login");
    }
  };

  const handleBookClick = (book: EResourceBook) => {
    if (isAuthenticated && user) {
      const role = user.role;
      if (role === "college-admin") navigate("/college-admin");
      else if (role === "general") navigate("/general-dashboard/e-resources");
      else if (role === "super-admin") navigate("/admin-portal");
      else navigate("/student-dashboard/e-resources");
    } else {
      // Requirement 6: Clicking any book card redirects unauthenticated users to Login/Registration page
      navigate("/auth/login", {
        state: { from: "e-resources", bookTitle: book.title },
      });
    }
  };

  return (
    <section
      id="e-resources"
      data-section="e-resources"
      className="bg-deep py-24 md:py-32 xl:py-40 border-y border-edge relative"
      ref={containerRef}
      aria-label="E-Resources"
    >
      {/* Anchor alias for #e-books support */}
      <div id="e-books" className="absolute -top-24 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        {/* Top Feature Hero */}
        <div className="flex flex-col md:flex-row items-center gap-12 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="w-full md:w-1/2"
          >
            <SectionLabel>70,000+ FREE BOOKS</SectionLabel>
            <h2 className="font-serif text-4xl md:text-5xl text-ink mb-6">
              Read anything. Anywhere.
              <br />
              No subscription needed.
            </h2>
            <p className="text-muted leading-relaxed text-lg mb-8">
              Powered by Project Gutenberg's public-domain catalog, filtered,
              searched, and read entirely inside BookBuddy — with your reading
              progress always saved.
            </p>
            <ul className="space-y-4 mb-8 text-ink font-medium">
              <li className="flex items-center gap-3">
                <span className="text-success text-xl">✓</span> Full in-app PDF &
                EPUB reader
              </li>
              <li className="flex items-center gap-3">
                <span className="text-success text-xl">✓</span> Pick up where you
                left off
              </li>
              <li className="flex items-center gap-3">
                <span className="text-success text-xl">✓</span> Download for
                offline reading
              </li>
              <li className="flex items-center gap-3">
                <span className="text-success text-xl">✓</span> Search by
                language, genre, author
              </li>
            </ul>
            {/* Requirement 1: "Browse the Library" CTA redirects to the Library / Catalog Search section */}
            <Button
              variant="secondary"
              size="lg"
              onClick={handleBrowseLibrary}
              aria-label="Browse the Library"
            >
              Browse the Library →
            </Button>
          </motion.div>

          {/* 3D Book Graphic */}
          <div className="w-full md:w-1/2 h-[500px] relative flex items-center justify-center perspective-1000 group cursor-pointer">
            <div
              className={`relative w-full max-w-sm aspect-[3/4] transition-all duration-1000 ease-out transform-style-3d group-hover:scale-105 group-hover:rotate-y-[-5deg] ${inView ? "rotate-y-[-15deg]" : "rotate-y-0 translate-y-12 opacity-0"}`}
            >
              {/* Book 3 (Back) */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-800 to-indigo-950 rounded-r-2xl rounded-l-md shadow-2xl border border-indigo-900 border-l-4 border-l-indigo-900/50 transform translate-x-12 translate-y-6 -z-20 rotate-6" />

              {/* Book 2 (Middle) */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 rounded-r-2xl rounded-l-md shadow-2xl border border-slate-800 border-l-4 border-l-slate-800/50 transform translate-x-6 translate-y-3 -z-10 rotate-3" />

              {/* Book 1 (Front) */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1E202E] to-[#0A0D15] rounded-r-3xl rounded-l-md shadow-[20px_20px_60px_rgba(0,0,0,0.8),-5px_0_20px_rgba(255,255,255,0.05)] border border-white/5 flex flex-col z-0 overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/60 via-white/10 to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-y-0 left-8 w-px bg-white/10 z-10" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none" />

                <div className="flex flex-col h-full p-10 pl-14 relative z-20">
                  <div className="w-12 h-1 bg-gradient-to-r from-ember to-ember-glow mb-12 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  <div className="text-sm font-bold tracking-widest text-indigo-300 uppercase mb-4">
                    Science Fiction
                  </div>
                  <h3 className="font-serif text-5xl text-white leading-tight mb-auto drop-shadow-md">
                    The Time
                    <br />
                    Machine
                  </h3>
                  <div className="flex items-center gap-3 mt-8">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/20 shadow-inner" />
                    <span className="text-sm text-indigo-100 font-medium tracking-wide">
                      H.G. Wells
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Requirement 5: Horizontal Scrolling Carousel of E-Resources */}
        <div className="mt-20 pt-16 border-t border-edge/60">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1 block">
                FREE IN-APP READING
              </span>
              <h3 className="font-serif text-2xl md:text-3xl lg:text-4xl text-ink font-semibold">
                Popular E-Resources & Classics
              </h3>
              <p className="text-muted text-sm md:text-base mt-2 max-w-2xl">
                Free, unrestricted access to timeless books and literature. Click any title to sign in and start reading.
              </p>
            </div>

            {/* Carousel Navigation Arrows */}
            <div className="flex items-center gap-3 self-start md:self-end">
              <button
                onClick={() => scrollCarousel("left")}
                aria-label="Scroll e-resources left"
                className="w-11 h-11 rounded-xl bg-surface border border-edge hover:border-ember/40 hover:bg-surface/80 flex items-center justify-center text-ink transition-all duration-200 active:scale-95 shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollCarousel("right")}
                aria-label="Scroll e-resources right"
                className="w-11 h-11 rounded-xl bg-surface border border-edge hover:border-ember/40 hover:bg-surface/80 flex items-center justify-center text-ink transition-all duration-200 active:scale-95 shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Horizontal Scrolling Track */}
          <div
            ref={carouselRef}
            data-testid="eresources-carousel"
            className="flex gap-6 overflow-x-auto scrollbar-none snap-x snap-mandatory py-2 scroll-smooth focus:outline-none"
            tabIndex={0}
            aria-label="E-Resources Books Carousel"
          >
            {ERESOURCE_BOOKS.map((book) => (
              <div
                key={book.id}
                data-testid="eresources-book-card"
                role="button"
                tabIndex={0}
                onClick={() => handleBookClick(book)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleBookClick(book);
                  }
                }}
                className="flex-shrink-0 w-64 md:w-72 bg-surface/70 hover:bg-surface border border-edge hover:border-indigo-400/40 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl group snap-start flex flex-col justify-between"
              >
                {/* Book Cover */}
                <div className="relative mb-4 overflow-hidden rounded-xl bg-void aspect-[3/4] shadow-md">
                  <BookCoverImage
                    src={book.coverImage}
                    alt={book.title}
                    aspectRatio="aspect-[3/4]"
                    fallbackTitle={book.title}
                    fallbackCategory={book.genre}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Hover Sign-in Callout */}
                  <div className="absolute inset-0 bg-void/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4 text-center backdrop-blur-xs">
                    <span className="text-xs font-bold text-white bg-indigo-600 px-3.5 py-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      Sign In to Read →
                    </span>
                  </div>

                  {/* Format Badge */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-indigo-300 backdrop-blur-md border border-indigo-500/20 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      {book.format}
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex flex-col flex-grow justify-between">
                  <div>
                    <span className="text-[11px] font-bold tracking-wider text-indigo-400 uppercase mb-1 block">
                      {book.genre}
                    </span>
                    <h3 className="font-serif text-lg font-semibold text-ink line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors">
                      {book.title}
                    </h3>
                    <p className="text-sm text-muted mt-1">{book.author}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-edge flex items-center justify-between text-xs text-muted">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <BookOpen className="w-3.5 h-3.5" />
                      Free E-Book
                    </span>
                    <span className="font-medium text-indigo-400 group-hover:underline">
                      Read Now →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
