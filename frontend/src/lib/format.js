const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// "just now", "5m ago", "3h ago", "2d ago", then a normal date after a week.
const timeAgo = (iso) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
};

// "First Last", falling back to the username.
const displayName = (user) => {
  if (!user) return '';
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
};

const initials = (user) =>
  displayName(user)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

// Blog bodies are HTML (from the Tiptap editor). This returns the plain text inside.
const htmlToText = (html = '') => {
  const spaced = html.replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>|<br\s*\/?>/gi, ' ');
  const doc = new DOMParser().parseFromString(spaced, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

const isBodyEmpty = (html) => htmlToText(html).length === 0;

const excerpt = (html, max = 180) => {
  const text = htmlToText(html);
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
};

const COUNT_UNITS = [
  [1_000_000_000, 'B'],
  [1_000_000, 'M'],
  [1_000, 'K'],
];

// 0-999 stay as they are. From 1,000 up the number is shortened to two significant digits,
// always rounded down (never up): 1,234 -> "1.2K", 15,900 -> "15K", 123,456 -> "120K",
// 1,234,567 -> "1.2M". Whole values drop the decimal: 1,000 -> "1K".
const formatCount = (count) => {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  if (value < 1000) return String(value);

  const [size, suffix] = COUNT_UNITS.find(([unit]) => value >= unit);
  let shown;
  if (value < size * 10) {
    const tenths = Math.floor((value * 10) / size); // 1.0 to 9.9, kept as whole tenths
    shown = tenths % 10 === 0 ? String(tenths / 10) : `${Math.floor(tenths / 10)}.${tenths % 10}`;
  } else if (value < size * 100) {
    shown = String(Math.floor(value / size)); // 10 to 99
  } else {
    shown = String(Math.floor(value / size / 10) * 10); // 100 to 990, two significant digits
  }
  return `${shown}${suffix}`;
};

export { formatDate, timeAgo, displayName, initials, htmlToText, isBodyEmpty, excerpt, formatCount };
