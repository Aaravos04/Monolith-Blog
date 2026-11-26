import { Bookmark } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Save / unsave a post for later. Bookmarks are private: they appear only in your own dashboard.
// Give it a `key` of the blog id if it may be reused for another post.
const BookmarkButton = ({ blogId, initialBookmarked, onChange }) => {
  const { isAuthenticated } = useAuth();
  const [bookmarked, setBookmarked] = useState(Boolean(initialBookmarked));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        state={{ from: `/blogs/${blogId}` }}
        title="Log in to bookmark this post"
        className="btn btn-outline"
      >
        <Bookmark size={16} aria-hidden="true" />
        Bookmark
      </Link>
    );
  }

  const toggle = async () => {
    if (busy) return;
    const next = !bookmarked;
    setBookmarked(next);
    setBusy(true);
    setError('');
    try {
      if (next) await api.bookmarkBlog(blogId);
      else await api.unbookmarkBlog(blogId);
      onChange?.(next);
    } catch (err) {
      setBookmarked(!next);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs">{error}</span>}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={bookmarked}
        title={bookmarked ? 'Remove bookmark' : 'Save for later'}
        className={`btn ${bookmarked ? 'btn-primary' : 'btn-outline'}`}
      >
        <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
        {bookmarked ? 'Bookmarked' : 'Bookmark'}
      </button>
    </span>
  );
};

export default BookmarkButton;
