import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

// Generic footer. Replace the links and text whenever you like.
const Footer = () => (
  <footer className="border-t border-ink">
    <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="inline-flex items-center gap-2 font-bold">
        <BookOpen size={16} aria-hidden="true" />
        Monolith
      </p>
      <nav className="flex gap-4" aria-label="Footer">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <Link to="/search" className="hover:underline">
          Search
        </Link>
        <Link to="/write" className="hover:underline">
          Write
        </Link>
        <Link to="/dashboard" className="hover:underline">
          Dashboard
        </Link>
      </nav>
      <p className="text-muted">© {new Date().getFullYear()} Monolith</p>
    </div>
  </footer>
);

export default Footer;
