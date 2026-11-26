import { Clock, Pencil, Sparkles, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import BlogList from '../components/BlogList';
import Tabs from '../components/Tabs';
import { useAuth } from '../context/AuthContext';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Home is a feed with three views: Latest (newest first), Following (people you follow, needs
// a login) and Recommended (chosen by the backend). It does not search: searching happens on
// /search, so the feed always stays the same. Guests also get a short intro banner on top.
const EMPTY = {
  latest: 'No posts yet.',
  following: 'Nothing here yet. Follow writers from their posts or profiles to fill this feed.',
  recommended: 'Nothing to recommend yet. Check back soon.',
};

const Home = () => {
  useDocumentTitle('');
  const { isAuthenticated } = useAuth();
  const [feed, setFeed] = useState('latest');

  // Guests can't use "following", so they fall back to "latest".
  const activeFeed = feed === 'following' && !isAuthenticated ? 'latest' : feed;
  const list = usePaginatedList((page) => api.listBlogs({ feed: activeFeed, page }), [activeFeed]);

  const tabs = [
    { key: 'latest', label: 'Latest', icon: Clock },
    ...(isAuthenticated ? [{ key: 'following', label: 'Following', icon: UserCheck }] : []),
    { key: 'recommended', label: 'Recommended', icon: Sparkles },
  ];

  return (
    <>
      {!isAuthenticated && (
        <section className="mb-8 border border-ink p-6 sm:p-8">
          <h1 className="text-3xl font-bold sm:text-4xl">Read. Write. Follow.</h1>
          <p className="mt-2 max-w-xl text-muted">
            Monolith is a place for ideas worth sharing. Browse the latest posts below, search for
            anything from the bar above, or create an account to start writing.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/register" className="btn btn-primary">
              Sign up
            </Link>
            <Link to="/login" className="btn btn-outline">
              Log in
            </Link>
          </div>
        </section>
      )}

      {isAuthenticated && (
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Your feed</h1>
          <Link to="/write" className="btn btn-primary">
            <Pencil size={16} aria-hidden="true" />
            Write a post
          </Link>
        </header>
      )}

      <Tabs tabs={tabs} active={activeFeed} onChange={setFeed} />

      <div className="pt-5">
        <BlogList {...list} emptyMessage={EMPTY[activeFeed]} />
      </div>
    </>
  );
};

export default Home;
