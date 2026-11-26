import { useEffect } from 'react';

// Sets the browser tab title: "Hello, Monolith · Monolith". Pass nothing for just "Monolith".
const useDocumentTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} · Monolith` : 'Monolith';
  }, [title]);
};

export { useDocumentTitle };
