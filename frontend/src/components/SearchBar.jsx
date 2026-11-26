import { Search } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DEFAULT_SEARCH_FIELD, SEARCH_FIELDS, isSearchField } from '../lib/search';

// A search box with a "search in" selector. Submitting opens /search?q=...&by=...
// It never changes the feed; results always live on the search page.
const SearchBar = ({ large = false, autoFocus = false }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = useId();

  // On the search page the URL holds the current search, so the inputs show it.
  const urlQuery = params.get('q') || '';
  const urlField = isSearchField(params.get('by')) ? params.get('by') : DEFAULT_SEARCH_FIELD;

  const [query, setQuery] = useState(urlQuery);
  const [field, setField] = useState(urlField);

  // Keep the inputs in step with the URL (back button, shared links).
  useEffect(() => {
    setQuery(urlQuery);
    setField(urlField);
  }, [urlQuery, urlField]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?${new URLSearchParams({ q: trimmed, by: field })}`);
  };

  return (
    <form role="search" onSubmit={handleSubmit} className="flex w-full">
      <label htmlFor={`${id}-by`} className="sr-only">
        Search in
      </label>
      <select
        id={`${id}-by`}
        value={field}
        onChange={(e) => setField(e.target.value)}
        className={`border border-ink bg-paper px-2 ${large ? 'text-base' : 'text-sm'}`}
      >
        {SEARCH_FIELDS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <label htmlFor={`${id}-q`} className="sr-only">
        Search posts
      </label>
      <input
        id={`${id}-q`}
        type="search"
        className={`input min-w-0 flex-1 border-l-0 ${large ? 'py-3 text-base' : ''}`}
        placeholder={`Search by ${field}…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus={autoFocus}
      />

      <button type="submit" className={`btn btn-primary ${large ? 'px-5' : ''}`} aria-label="Search">
        <Search size={16} aria-hidden="true" />
      </button>
    </form>
  );
};

export default SearchBar;
