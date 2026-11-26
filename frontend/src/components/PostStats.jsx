import { Bookmark, Heart, MessageSquare } from 'lucide-react';
import { formatCount } from '../lib/format';

// Read-only like and comment totals (3,400 shows as "3.4K"). Used on post cards and in your
// dashboard. The heart is filled when you liked the post, and a "Saved" tag shows when you
// bookmarked it. Pass `showSaved={false}` to hide that tag.
const PostStats = ({ blog, showSaved = true, className = '' }) => {
  const likes = blog.likes_count ?? 0;
  const comments = blog.comments_count ?? 0;

  return (
    <p className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium text-muted ${className}`}>
      <span className="inline-flex items-center gap-1" title={`${likes} likes`}>
        <Heart size={16} fill={blog.liked_by_me ? 'currentColor' : 'none'} aria-hidden="true" />
        {formatCount(likes)}
        <span className="sr-only">{likes === 1 ? 'like' : 'likes'}</span>
      </span>
      <span className="inline-flex items-center gap-1" title={`${comments} comments`}>
        <MessageSquare size={16} aria-hidden="true" />
        {formatCount(comments)}
        <span className="sr-only">{comments === 1 ? 'comment' : 'comments'}</span>
      </span>
      {showSaved && blog.bookmarked_by_me && (
        <span className="inline-flex items-center gap-1">
          <Bookmark size={16} fill="currentColor" aria-hidden="true" />
          Saved
        </span>
      )}
    </p>
  );
};

export default PostStats;
