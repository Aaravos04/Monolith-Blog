import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { formatDate } from '../lib/format';
import AuthorLink from './AuthorLink';
import Notice from './Notice';
import ReportButton from './ReportButton';

// `onCountChange(blogId, count)` is called whenever the number of comments changes, so the
// blog page can keep its own comment total in step.
const CommentSection = ({ blogId, onCountChange }) => {
  const { user, isAuthenticated } = useAuth();
  const { data: comments, loading, error, setData } = useAsync(
    () => api.listComments(blogId),
    [blogId]
  );
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (comments) onCountChange?.(blogId, comments.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setFormError('');
    try {
      const created = await api.addComment(blogId, { body });
      setData([...(comments || []), created]);
      setBody('');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (comment) => {
    setFormError('');
    try {
      await api.deleteComment(blogId, comment.id);
      setData(comments.filter((c) => c.id !== comment.id));
    } catch (err) {
      setFormError(err.message);
    }
  };

  return (
    <section className="mt-12 border-t border-ink pt-6" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="flex items-center gap-2 text-xl font-bold">
        <MessageSquare size={20} aria-hidden="true" />
        Comments{comments ? ` (${comments.length})` : ''}
      </h2>

      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mt-4">
          <label htmlFor="comment-body" className="sr-only">
            Add a comment
          </label>
          <textarea
            id="comment-body"
            rows={3}
            className="input"
            placeholder="Share your thoughts…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button className="btn btn-primary mt-2" disabled={posting || !body.trim()}>
            <Send size={14} aria-hidden="true" />
            {posting ? 'Posting…' : 'Post comment'}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">
          <Link
            to="/login"
            state={{ from: `/blogs/${blogId}` }}
            className="font-medium text-ink underline"
          >
            Log in
          </Link>{' '}
          to join the conversation.
        </p>
      )}

      {formError && <Notice className="mt-4">{formError}</Notice>}
      {error && <Notice className="mt-4">{error}</Notice>}
      {loading && !comments && <p className="mt-4 text-sm text-muted">Loading comments…</p>}
      {comments && comments.length === 0 && (
        <p className="mt-4 text-sm text-muted">No comments yet. Be the first.</p>
      )}

      <ul className="mt-4">
        {(comments || []).map((c) => (
          <li key={c.id} className="border-b border-ink py-3 last:border-b-0">
            <div className="flex items-center gap-3 text-sm">
              <strong>
                <AuthorLink author={c.author} avatar avatarSize="sm" />
              </strong>
              <span className="text-xs text-muted">@{c.author.username}</span>
              <time className="flex-1 text-xs text-muted" dateTime={c.created_at}>
                {formatDate(c.created_at)}
              </time>
              {user && c.author.id === user.id ? (
                <button
                  type="button"
                  onClick={() => handleDelete(c)}
                  className="inline-flex items-center gap-1 text-xs hover:underline"
                >
                  <Trash2 size={12} aria-hidden="true" />
                  Delete
                </button>
              ) : (
                <ReportButton type="comment" id={c.id} subject={c.body} />
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default CommentSection;
