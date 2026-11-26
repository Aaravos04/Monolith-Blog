import { Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format';
import PostStats from './PostStats';

// One of your own posts or drafts, in the dashboard.
const PostRow = ({ blog, onDelete }) => {
  const isDraft = blog.status === 'draft';

  return (
    <li className="flex items-start justify-between gap-4 border-b border-ink py-4 last:border-b-0">
      <div className="min-w-0">
        <h3 className="truncate font-bold">
          <Link to={`/blogs/${blog.id}`} className="hover:underline">
            {blog.title || 'Untitled'}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {isDraft && (
            <span className="border border-ink px-1.5 py-0.5 font-medium text-ink">Draft</span>
          )}
          <span>
            {isDraft ? 'Last edited' : 'Published'}{' '}
            {formatDate(isDraft ? blog.updated_at : blog.published_at)}
          </span>
        </p>
        {!isDraft && <PostStats blog={blog} showSaved={false} className="mt-1" />}
      </div>

      <div className="flex shrink-0 gap-2">
        <Link to={`/write/${blog.id}`} className="btn btn-outline btn-sm">
          <Pencil size={14} aria-hidden="true" />
          Edit
        </Link>
        <button
          type="button"
          onClick={() => onDelete(blog)}
          className="btn btn-outline btn-sm"
          aria-label={`Delete ${blog.title || 'Untitled'}`}
        >
          <Trash2 size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </li>
  );
};

export default PostRow;
