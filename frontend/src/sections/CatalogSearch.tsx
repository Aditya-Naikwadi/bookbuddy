import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, MapPin, CheckCircle2 } from "lucide-react";
import { SectionLabel } from "../components/ui/SectionLabel";
import { BookCoverImage } from "../components/common/BookCoverImage";
import useAuthStore from "../store/authStore";

interface CatalogBook {
  id: string;
  title: string;
  author: string;
  category: string;
  shelf: string;
  availability: string;
  coverImage?: string;
}

const CATALOG_BOOKS: CatalogBook[] = [
  {
    id: "cat-1",
    title: "Clean Code: A Handbook of Agile Software Craftsmanship",
    author: "Robert C. Martin",
    category: "Computer Science",
    shelf: "Shelf CS-204",
    availability: "Available",
    coverImage: "https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=400&q=80",
  },
  {
    id: "cat-2",
    title: "Introduction to Algorithms, 4th Edition",
    author: "Thomas H. Cormen et al.",
    category: "Algorithms",
    shelf: "Shelf AL-101",
    availability: "Available",
    coverImage: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80",
  },
  {
    id: "cat-3",
    title: "Designing Data-Intensive Applications",
    author: "Martin Kleppmann",
    category: "System Design",
    shelf: "Shelf SD-305",
    availability: "Available",
    coverImage: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&q=80",
  },
  {
    id: "cat-4",
    title: "Artificial Intelligence: A Modern Approach",
    author: "Stuart Russell & Peter Norvig",
    category: "AI & ML",
    shelf: "Shelf AI-402",
    availability: "3 Copies Left",
    coverImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&q=80",
  },
  {
    id: "cat-5",
    title: "Operating System Concepts",
    author: "Abraham Silberschatz",
    category: "Systems",
    shelf: "Shelf OS-110",
    availability: "Available",
    coverImage: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&q=80",
  },
  {
    id: "cat-6",
    title: "Structure and Interpretation of Computer Programs",
    author: "Harold Abelson & Gerald Jay Sussman",
    category: "Programming",
    shelf: "Shelf CS-118",
    availability: "Available",
    coverImage: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80",
  },
  {
    id: "cat-7",
    title: "Computer Networking: A Top-Down Approach",
    author: "James Kurose & Keith Ross",
    category: "Networking",
    shelf: "Shelf NW-220",
    availability: "Available",
    coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&q=80",
  },
];

const CATEGORIES = ["All", "Computer Science", "Algorithms", "System Design", "AI & ML", "Systems"];

export const CatalogSearch: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredBooks =
    activeCategory === "All"
      ? CATALOG_BOOKS
      : CATALOG_BOOKS.filter((b) => b.category === activeCategory);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleBookClick = (book: CatalogBook) => {
    if (isAuthenticated && user) {
      const role = user.role;
      if (role === "college-admin") navigate("/college-admin");
      else if (role === "general") navigate("/general-dashboard/search");
      else if (role === "super-admin") navigate("/admin-portal");
      else navigate("/student-dashboard/catalog");
    } else {
      // Requirement 6: Clicking any book card redirects unauthenticated users to Login/Registration page
      navigate("/auth/login", {
        state: { from: "catalog-search", bookTitle: book.title },
      });
    }
  };

  return (
    <section
      id="catalog-search"
      data-section="catalog-search"
      className="bg-void py-24 md:py-32 border-b border-edge relative overflow-hidden"
      aria-label="Catalog Search"
    >
      {/* Background glow decoration */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-indigo-500/5 via-ember/5 to-transparent rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        {/* Section Header & Navigation Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <SectionLabel>CAMPUS COLLECTION</SectionLabel>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-ink mt-2 mb-4">
              Catalog Search
            </h2>
            <p className="text-muted text-base md:text-lg max-w-2xl leading-relaxed">
              Explore 15,000+ course reserves and physical volumes across campus library branches.
              Sign in to reserve physical copies, track loans, or join waitlists.
            </p>
          </div>

          {/* Carousel Arrows */}
          <div className="flex items-center gap-3 self-start md:self-end">
            <button
              onClick={() => scroll("left")}
              aria-label="Scroll catalog left"
              className="w-11 h-11 rounded-xl bg-surface border border-edge hover:border-ember/40 hover:bg-surface/80 flex items-center justify-center text-ink transition-all duration-200 active:scale-95 shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Scroll catalog right"
              className="w-11 h-11 rounded-xl bg-surface border border-edge hover:border-ember/40 hover:bg-surface/80 flex items-center justify-center text-ink transition-all duration-200 active:scale-95 shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 border ${
                activeCategory === cat
                  ? "bg-ember text-white border-ember shadow-sm"
                  : "bg-surface/60 text-muted border-edge hover:border-white/20 hover:text-ink"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Horizontal Scrolling Book Carousel */}
        <div
          ref={scrollRef}
          data-testid="catalog-carousel"
          className="flex gap-6 overflow-x-auto scrollbar-none snap-x snap-mandatory py-2 scroll-smooth focus:outline-none"
          tabIndex={0}
          aria-label="Catalog Books Carousel"
        >
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              data-testid="catalog-book-card"
              role="button"
              tabIndex={0}
              onClick={() => handleBookClick(book)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleBookClick(book);
                }
              }}
              className="flex-shrink-0 w-64 md:w-72 bg-surface/70 hover:bg-surface border border-edge hover:border-ember/40 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl group snap-start flex flex-col justify-between"
            >
              {/* Cover Image Container */}
              <div className="relative mb-4 overflow-hidden rounded-xl bg-deep aspect-[3/4] shadow-md">
                <BookCoverImage
                  src={book.coverImage}
                  alt={book.title}
                  aspectRatio="aspect-[3/4]"
                  fallbackTitle={book.title}
                  fallbackCategory={book.category}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Subtle Hover Action Pill */}
                <div className="absolute inset-0 bg-void/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4 text-center backdrop-blur-xs">
                  <span className="text-xs font-bold text-white bg-ember px-3.5 py-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    Sign In to Reserve →
                  </span>
                </div>

                {/* Status Badge */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-emerald-300 backdrop-blur-md border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {book.availability}
                  </span>
                </div>
              </div>

              {/* Book Metadata */}
              <div className="flex flex-col flex-grow justify-between">
                <div>
                  <span className="text-[11px] font-bold tracking-wider text-ember uppercase mb-1 block">
                    {book.category}
                  </span>
                  <h3 className="font-serif text-lg font-semibold text-ink line-clamp-2 leading-snug group-hover:text-ember transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-sm text-muted mt-1">{book.author}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-edge flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    {book.shelf}
                  </span>
                  <span className="font-medium text-ember hover:underline">
                    Details →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CatalogSearch;
