import { Link } from 'react-router-dom';
import { excerpt, formatDate } from '../lib/format';
import AuthorLink from './AuthorLink';
import PostStats from './PostStats';

// One row in a list of posts.
const BlogCard = ({ blog }) => (
  <article className="flex gap-4 border-b border-ink py-5 first:pt-0 last:border-b-0">
    <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <AuthorLink author={blog.author} avatar avatarSize="xs" className="font-medium text-ink" />
        <span aria-hidden="true">·</span>
        <time dateTime={blog.published_at}>{formatDate(blog.published_at)}</time>
      </p>
      <h2 className="mt-1 text-xl font-bold">
        <Link to={`/blogs/${blog.id}`} className="hover:underline">
          {blog.title}
        </Link>
      </h2>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{excerpt(blog.body)}</p>
      <PostStats blog={blog} className="mt-2" />
    </div>

    {blog.cover_image && (
      <Link to={`/blogs/${blog.id}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
        <img
          src={blog.cover_image}
          alt=""
          className="h-24 w-32 border border-ink object-cover sm:h-28 sm:w-40"
        />
      </Link>
    )}
  </article>
);

export default BlogCard;
