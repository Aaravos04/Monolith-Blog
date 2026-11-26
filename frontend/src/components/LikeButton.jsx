import { Heart } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatCount } from '../lib/format';

// Like / unlike with the total next to it. The heart flips straight away, and goes back if the
// server says no. Logged-out readers are sent to log in and then returned to the post.
// Give it a `key` of the blog id if it may be reused for another post.
const LikeButton = ({ blogId, initialLiked, initialCount, onChange }) => {
  const { isAuthenticated } = useAuth();
  const [liked, setLiked] = useState(Boolean(initialLiked));
  const [count, setCount] = useState(initialCount ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const content = (
    <>
      <Heart size={16} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
      {formatCount(count)}
    </>
  );

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        state={{ from: `/blogs/${blogId}` }}
        title="Log in to like this post"
        aria-label={`${count} likes. Log in to like this post`}
        className="btn btn-outline"
      >
        {content}
      </Link>
    );
  }

  const toggle = async () => {
    if (busy) return;
    const next = !liked;
    const step = next ? 1 : -1;
    setLiked(next);
    setCount((c) => Math.max(0, c + step));
    setBusy(true);
    setError('');
    try {
      const result = next ? await api.likeBlog(blogId) : await api.unlikeBlog(blogId);
      // Settle on the server's numbers when it sends them.
      if (typeof result?.liked === 'boolean') setLiked(result.liked);
      if (typeof result?.likes_count === 'number') setCount(result.likes_count);
      onChange?.({ liked: next, likes_count: result?.likes_count });
    } catch (err) {
      setLiked(!next);
      setCount((c) => Math.max(0, c - step));
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
        aria-pressed={liked}
        aria-label={`${liked ? 'Unlike' : 'Like'} this post. ${count} likes`}
        title={`${count} likes`}
        className={`btn ${liked ? 'btn-primary' : 'btn-outline'}`}
      >
        {content}
      </button>
    </span>
  );
};

export default LikeButton;
