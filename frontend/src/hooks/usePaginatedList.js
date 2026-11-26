import { useEffect, useRef, useState } from 'react';

const initialState = {
  items: [],
  page: 1,
  hasMore: false,
  loading: true,
  loadingMore: false,
  error: '',
};

// Loads a list one page at a time.
//   fetchPage(page) must resolve to { results: [...], hasMore: boolean }
// The list starts over whenever `deps` change (a new search, another tab, another user).
// loadMore() fetches the next page and appends it.
const usePaginatedList = (fetchPage, deps) => {
  const [state, setState] = useState(initialState);

  // Always call the latest fetchPage without making it a dependency.
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  // Bumped on every reset so a slow, outdated response never overwrites newer results.
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    const id = requestId.current;
    setState(initialState);

    fetchRef
      .current(1)
      .then(({ results, hasMore }) => {
        if (id !== requestId.current) return;
        setState({ ...initialState, items: results, hasMore, loading: false });
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setState({ ...initialState, loading: false, error: err.message });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = async () => {
    if (state.loading || state.loadingMore || !state.hasMore) return;
    const id = requestId.current;
    const nextPage = state.page + 1;
    setState((s) => ({ ...s, loadingMore: true, error: '' }));
    try {
      const { results, hasMore } = await fetchRef.current(nextPage);
      if (id !== requestId.current) return;
      setState((s) => ({
        ...s,
        items: [...s.items, ...results],
        page: nextPage,
        hasMore,
        loadingMore: false,
      }));
    } catch (err) {
      if (id !== requestId.current) return;
      setState((s) => ({ ...s, loadingMore: false, error: err.message }));
    }
  };

  return { ...state, loadMore };
};

export { usePaginatedList };
