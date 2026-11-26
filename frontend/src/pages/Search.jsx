import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import BlogList from '../components/BlogList';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { DEFAULT_SEARCH_FIELD, SEARCH_FIELDS, isSearchField } from '../lib/search';

const NO_RESULTS = { results: [], hasMore: false };

// The search page. The search lives in the URL (/search?q=react&by=title&page=2), so results,
// and the page you are on, can be bookmarked, shared, and the back button works.
// Results come one page at a time with Previous / Next.
const Search = () => {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  useDocumentTitle(q ? `Search: ${q}` : 'Search');
  const requested = params.get('by');
  const by = isSearchField(requested) ? requested : DEFAULT_SEARCH_FIELD;
  const fieldLabel = SEARCH_FIELDS.find((field) => field.value === by).label.toLowerCase();

  // A missing or silly ?page= value means page 1.
  const requestedPage = Number.parseInt(params.get('page'), 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const { data, loading, error } = useAsync(
    () => (q ? api.searchBlogs({ q, by, page }) : Promise.resolve(NO_RESULTS)),
    [q, by, page]
  );

  const goToPage = (next) => {
    const nextParams = new URLSearchParams(params);
    if (next <= 1) nextParams.delete('page');
    else nextParams.set('page', String(next));
    setParams(nextParams);
    window.scrollTo(0, 0);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Search</h1>

      <div className="mt-4">
        <SearchBar large autoFocus={!q} />
      </div>

      <div className="mt-8">
        {q ? (
          <>
            <p className="mb-4 border-b border-ink pb-2 text-sm text-muted">
              Results for “{q}” in {fieldLabel}
              {page > 1 ? `, page ${page}` : ''}
            </p>
            <BlogList
              items={loading ? [] : (data?.results ?? [])}
              loading={loading}
              loadingMore={false}
              error={error}
              hasMore={false}
              loadMore={() => {}}
              emptyMessage={
                page > 1
                  ? 'There are no more results.'
                  : 'No posts found. Try different words, or search in another field.'
              }
            />
            {!loading && !error && (
              <Pagination page={page} hasMore={Boolean(data?.hasMore)} onPageChange={goToPage} />
            )}
          </>
        ) : (
          <p className="py-8 text-center text-muted">Search posts by title, content or author.</p>
        )}
      </div>
    </div>
  );
};

export default Search;
