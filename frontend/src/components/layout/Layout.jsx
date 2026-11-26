import { Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import Footer from './Footer';
import Navbar from './Navbar';

// Wraps every page with the shared navbar and footer. Pages render where <Outlet /> is.
// If a page crashes, only the page area shows the error message, and moving to another
// page (a new path) resets it.
const Layout = () => {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
