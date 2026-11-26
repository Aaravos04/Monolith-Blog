import { useAuth } from '../context/AuthContext';
import { usePaginatedList } from '../hooks/usePaginatedList';
import Modal from './Modal';
import Notice from './Notice';
import UserRow from './UserRow';

// The list inside the dialog. Modal only renders its children while it is open, so this starts
// fresh (page 1) every time the dialog is opened.
const PeopleList = ({ fetchPage, emptyMessage, onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const list = usePaginatedList(fetchPage, []);

  // Following a link to someone's profile should also close the dialog.
  const handleClick = (e) => {
    if (e.target.closest('a')) onClose();
  };

  return (
    <div className="mt-4">
      {list.error && <Notice className="mb-3">{list.error}</Notice>}
      {list.loading && <p className="text-sm text-muted">Loading…</p>}
      {!list.loading && !list.error && list.items.length === 0 && (
        <p className="py-6 text-center text-muted">{emptyMessage}</p>
      )}

      {list.items.length > 0 && (
        <ul onClick={handleClick} className="max-h-[60vh] overflow-y-auto border-t border-ink">
          {list.items.map((person) => (
            <UserRow
              key={person.id}
              person={person}
              showFollow={isAuthenticated && user.id !== person.id}
            />
          ))}
        </ul>
      )}

      {list.hasMore && (
        <div className="pt-4 text-center">
          <button
            type="button"
            className="btn btn-outline"
            onClick={list.loadMore}
            disabled={list.loadingMore}
          >
            {list.loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};

// A popup list of people, a page at a time. Used for "who liked this post" and for a profile's
// followers and following.
//   fetchPage(page) must resolve to { results: [person, ...], hasMore: boolean }
const PeopleDialog = ({ open, onClose, title, fetchPage, emptyMessage }) => (
  <Modal open={open} onClose={onClose} title={title}>
    <PeopleList fetchPage={fetchPage} emptyMessage={emptyMessage} onClose={onClose} />
  </Modal>
);

export default PeopleDialog;
