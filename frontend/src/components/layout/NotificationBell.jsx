import { Bell, CheckCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { useNotifications } from '../../hooks/useNotifications';
import Notice from '../Notice';
import NotificationItem from '../NotificationItem';

// A bell in the navbar. It shows a dot while something is unread, and opens a floating panel
// (not a page) with the current notifications.
const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const { items, loading, error, hasUnread, refresh, markRead, markAllRead, remove } =
    useNotifications();

  useDismiss(
    wrapperRef,
    (reason) => {
      setOpen(false);
      if (reason === 'escape') buttonRef.current?.focus();
    },
    open
  );

  const toggle = () => {
    if (!open) refresh(); // always show fresh data when opening
    setOpen((o) => !o);
  };

  return (
    // On phones the panel spans the navbar width; from `sm` up it hangs under the bell.
    <div ref={wrapperRef} className="sm:relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={hasUnread ? 'Notifications, you have unread notifications' : 'Notifications'}
        className="relative flex h-9 w-9 items-center justify-center border border-transparent hover:border-ink"
      >
        <Bell size={18} aria-hidden="true" />
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-ink ring-2 ring-paper"
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute inset-x-4 top-full z-30 mt-2 border border-ink bg-paper sm:inset-x-auto sm:right-0 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-ink px-4 py-3">
            <h2 className="font-bold">Notifications</h2>
            {hasUnread && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs hover:underline"
              >
                <CheckCheck size={14} aria-hidden="true" />
                Mark all as read
              </button>
            )}
          </div>

          {error && (
            <div className="p-3">
              <Notice>{error}</Notice>
            </div>
          )}

          {loading && items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">You are all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markRead}
                  onDelete={remove}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
