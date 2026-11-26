import { ArrowLeft, MessageSquare, Pencil, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import AuthorLink from '../components/AuthorLink';
import Avatar from '../components/Avatar';
import BookmarkButton from '../components/BookmarkButton';
import CommentSection from '../components/CommentSection';
import FollowButton from '../components/FollowButton';
import LikeButton from '../components/LikeButton';
import Notice from '../components/Notice';
import PeopleDialog from '../components/PeopleDialog';
import ReportButton from '../components/ReportButton';
import RichContent from '../components/RichContent';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { displayName, formatCount, formatDate } from '../lib/format';
import NotFound from './NotFound';

const BlogDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { data: blog, loading, error, status } = useAsync(() => api.getBlog(id), [id]);
  const [actionError, setActionError] = useState('');
  // The live comment total, reported by CommentSection as people add or delete comments.
  const [liveComments, setLiveComments] = useState(null);
  const [likersOpen, setLikersOpen] = useState(false);
  useDocumentTitle(blog ? blog.title : '');

  if (status === 404) {
    return (
      <NotFound
        title="Post not found"
        message="This post does not exist, or it was deleted by its author."
      />
    );
  }
  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Notice>{error}</Notice>
        <Link to="/" className="inline-flex items-center gap-1 text-sm underline">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to all posts
        </Link>
      </div>
    );
  }

  const isAuthor = Boolean(user) && blog.author.id === user.id;
  const isDraft = blog.status === 'draft';
  const commentCount =
    liveComments?.blogId === blog.id ? liveComments.count : (blog.comments_count ?? 0);

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api.deleteBlog(id);
      navigate('/dashboard');
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <>
      <article className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm hover:underline">
          <ArrowLeft size={14} aria-hidden="true" />
          Back
        </Link>

        {isDraft && (
          <Notice kind="info" className="mt-4">
            This is a draft. Only you can see it.{' '}
            <Link to={`/write/${blog.id}`} className="font-medium underline">
              Keep editing
            </Link>
          </Notice>
        )}

        {blog.cover_image && (
          <img
            src={blog.cover_image}
            alt={`Cover image for ${blog.title}`}
            className="mt-4 aspect-[2/1] w-full border border-ink object-cover"
          />
        )}

        <h1 className="mt-6 text-3xl font-bold leading-tight sm:text-4xl">{blog.title}</h1>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-ink py-3 text-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={`/users/${encodeURIComponent(blog.author.username)}`}
              aria-label={`${displayName(blog.author)}'s profile`}
              className="shrink-0"
            >
              <Avatar user={blog.author} size="md" />
            </Link>
            <div className="min-w-0">
              <p>
                <AuthorLink author={blog.author} className="font-bold" />{' '}
                <span className="text-muted">@{blog.author.username}</span>
              </p>
              <p className="text-xs text-muted">
                <time dateTime={isDraft ? blog.updated_at : blog.published_at}>
                  {formatDate(isDraft ? blog.updated_at : blog.published_at)}
                </time>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthor ? (
              <>
                <Link to={`/write/${blog.id}`} className="btn btn-outline btn-sm">
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </Link>
                <button type="button" onClick={handleDelete} className="btn btn-outline btn-sm">
                  <Trash2 size={14} aria-hidden="true" />
                  Delete
                </button>
              </>
            ) : (
              isAuthenticated && (
                <>
                  <FollowButton
                    key={blog.author.id}
                    userId={blog.author.id}
                    initialFollowing={blog.author.is_following}
                  />
                  <ReportButton variant="button" type="blog" id={blog.id} subject={blog.title} />
                </>
              )
            )}
          </div>
        </div>

        {!isDraft && (
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Post actions">
            <LikeButton
              key={`like-${blog.id}`}
              blogId={blog.id}
              initialLiked={blog.liked_by_me}
              initialCount={blog.likes_count}
            />
            <a
              href="#comments-heading"
              title={`${commentCount} comments`}
              aria-label={`${commentCount} comments. Jump to comments`}
              className="btn btn-outline"
            >
              <MessageSquare size={16} aria-hidden="true" />
              {formatCount(commentCount)}
            </a>
            <BookmarkButton
              key={`bookmark-${blog.id}`}
              blogId={blog.id}
              initialBookmarked={blog.bookmarked_by_me}
            />
            <button
              type="button"
              onClick={() => setLikersOpen(true)}
              aria-haspopup="dialog"
              className="inline-flex items-center gap-1 px-1 text-sm hover:underline"
            >
              <Users size={14} aria-hidden="true" />
              Who liked this
            </button>
          </div>
        )}

        {actionError && <Notice className="mt-4">{actionError}</Notice>}

        <RichContent html={blog.body} className="mt-8" />
      </article>

      {!isDraft && (
        <PeopleDialog
          open={likersOpen}
          onClose={() => setLikersOpen(false)}
          title="Liked by"
          fetchPage={(page) => api.listBlogLikers(blog.id, { page })}
          emptyMessage="No likes yet. Be the first."
        />
      )}

      {!isDraft && (
        <div className="mx-auto max-w-2xl">
          <CommentSection
            blogId={blog.id}
            onCountChange={(blogId, count) => setLiveComments({ blogId, count })}
          />
        </div>
      )}
    </>
  );
};

export default BlogDetail;
