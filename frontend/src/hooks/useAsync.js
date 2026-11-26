import { useEffect, useState } from 'react';

// Runs an async function whenever `deps` change and tracks loading / error / data.
// `status` is the HTTP status of a failed request (for example 404), or null.
const useAsync = (fn, deps) => {
  const [state, setState] = useState({ data: null, error: '', status: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '', status: null }));
    fn()
      .then((data) => {
        if (!cancelled) setState({ data, error: '', status: null, loading: false });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ data: null, error: err.message, status: err.status ?? null, loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = (data) => setState((s) => ({ ...s, data }));
  return { ...state, setData };
};

export { useAsync };
