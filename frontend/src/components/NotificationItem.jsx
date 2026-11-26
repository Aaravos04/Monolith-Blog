import { Check, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { displayName, timeAgo } from '../lib/format';
import Avatar from './Avatar';

const iconButtonClass =
  'flex h-7 w-7 items-center justify-center border border-transparent hover:border-ink hover:bg-paper hover:text-ink';

// What the notification says after the person's name, and where it links to.
const describe = (notification) => {
  const { type, actor, blog } = notification;
  if (type === 'follow') {
    return { text: 'started following you', to: `/users/${encodeURIComponent(actor.username)}` };
  }
  if (type === 'comment') {
    return { text: `commented on “${blog.title}”`, to: `/blogs/${blog.id}` };
  }
  if (type === 'like') {
    return { text: `liked “${blog.title}”`, to: `/blogs/${blog.id}` };
  }
  // 'new_post': someone you follow published something
  return { text: `published “${blog.title}”`, to: `/blogs/${blog.id}` };
};

// One row in the notifications panel. Unread rows are highlighted; read rows are grayed out.
const NotificationItem = ({ notification, onRead, onDelete, onNavigate }) => {
  const { id, actor, created_at: createdAt, is_read: isRead } = notification;
  const { text, to } = describe(notification);

  // Opening the thing a notification points to counts as reading it.
  const handleOpen = () => {
    if (!isRead) onRead(id);
    onNavigate();
  };

  return (
    <li
      className={`flex gap-3 border-b border-ink px-4 py-3 last:border-b-0 ${
        isRead ? 'text-muted' : 'bg-subtle'
      }`}
    >
      <Avatar user={actor} size="sm" className={isRead ? 'opacity-50' : ''} />

      <div className="min-w-0 flex-1">
        <Link to={to} onClick={handleOpen} className="block break-words text-sm hover:underline">
          <strong className={isRead ? 'font-medium' : 'font-bold'}>{displayName(actor)}</strong> {text}
        </Link>
        <p className="mt-0.5 text-xs">{timeAgo(createdAt)}</p>
      </div>

      <div className="flex shrink-0 items-start gap-1">
        {!isRead && (
          <button
            type="button"
            title="Mark as read"
            aria-label="Mark as read"
            onClick={() => onRead(id)}
            className={iconButtonClass}
          >
            <Check size={14} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          title="Delete notification"
          aria-label="Delete notification"
          onClick={() => onDelete(id)}
          className={iconButtonClass}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
};

export default NotificationItem;
