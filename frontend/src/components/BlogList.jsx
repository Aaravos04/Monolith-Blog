import BlogCard from './BlogCard';
import Notice from './Notice';

// A list of blog cards with loading, empty and "Load more" states.
// Props match what usePaginatedList returns, so you can write <BlogList {...list} emptyMessage="..." />
const BlogList = ({ items, loading, loadingMore, error, hasMore, loadMore, emptyMessage }) => (
  <div>
    {error && <Notice className="mb-4">{error}</Notice>}
    {loading && <p className="text-sm text-muted">Loading posts…</p>}
    {!loading && !error && items.length === 0 && (
      <p className="py-8 text-center text-muted">{emptyMessage}</p>
    )}

    {items.map((blog) => (
      <BlogCard key={blog.id} blog={blog} />
    ))}

    {hasMore && (
      <div className="pt-6 text-center">
        <button type="button" className="btn btn-outline" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      </div>
    )}
  </div>
);

export default BlogList;
