import { BookOpen, LogIn } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SearchBar from '../SearchBar';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';

// Generic navbar: brand, search, then the account area. Logged in, the account area is the
// notification bell and a profile-picture menu. On small screens the search drops to its own row.
const Navbar = () => {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();

  // The search page has its own, larger search box, so the navbar one is hidden there.
  const onSearchPage = pathname === '/search';

  return (
    <header className="border-b border-ink bg-paper">
      <div className="relative mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3">
        <Link to="/" className="inline-flex items-center gap-2 text-xl font-bold">
          <BookOpen size={22} aria-hidden="true" />
          Monolith
        </Link>

        {!onSearchPage && (
          <div className="order-last w-full sm:order-none sm:w-auto sm:max-w-md sm:flex-1">
            <SearchBar />
          </div>
        )}

        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Main">
          {isAuthenticated ? (
            <>
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">
                <LogIn size={14} aria-hidden="true" />
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
