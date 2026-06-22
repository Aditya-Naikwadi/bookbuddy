import { Link } from 'react-router-dom';
import { BookOpen, Search, Library, Award } from 'lucide-react';

const Landing = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <nav className="w-full bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <BookOpen className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold font-serif text-slate-900 tracking-tight">BookBuddy</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/auth/login" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">
                Log in
              </Link>
              <Link to="/auth/register" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
              Your Library, <span className="text-indigo-600">Reimagined</span>.
            </h1>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed">
              BookBuddy is the modern, all-in-one platform for managing your academic resources. Discover books, track your reading streaks, and unlock achievements seamlessly.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/auth/register" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                Start Reading Today
              </Link>
              <Link to="/auth/login" className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-sm">
                Access Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="bg-white py-24 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                  <Search className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Smart Catalog</h3>
                <p className="text-slate-600">Instantly search through thousands of physical and digital resources across your campus library network.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                  <Library className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Digital E-Resources</h3>
                <p className="text-slate-600">Access academic journals, e-books, and research papers from anywhere with our built-in reader.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-6">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Gamified Reading</h3>
                <p className="text-slate-600">Build reading streaks, earn stickers, and unlock achievements as you progress through your reading lists.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-center">
        <p>© {new Date().getFullYear()} BookBuddy Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Landing;
