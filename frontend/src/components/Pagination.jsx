import { ChevronLeft, ChevronRight } from 'lucide-react';

// Previous / Next controls for a list that is shown one page at a time.
// The API only says whether another page exists (`hasMore`), not how many there are,
// so there are no page numbers to jump to. Hidden when everything fits on one page.
const Pagination = ({ page, hasMore, onPageChange, disabled = false }) => {
  if (page <= 1 && !hasMore) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 pt-6">
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        <ChevronLeft size={14} aria-hidden="true" />
        Previous
      </button>
      <span className="text-sm text-muted" aria-current="page">
        Page {page}
      </span>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || !hasMore}
      >
        Next
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  );
};

export default Pagination;
