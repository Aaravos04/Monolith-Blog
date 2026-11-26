import { Link } from 'react-router-dom';
import { displayName } from '../lib/format';
import Avatar from './Avatar';

// An author's name, linking to their public profile. Use it anywhere an author is shown.
// Pass `avatar` to show their picture in front of the name.
const AuthorLink = ({ author, className = '', avatar = false, avatarSize = 'xs' }) => (
  <Link
    to={`/users/${encodeURIComponent(author.username)}`}
    className={`${avatar ? 'inline-flex items-center gap-2' : ''} hover:underline ${className}`}
  >
    {avatar && <Avatar user={author} size={avatarSize} />}
    {displayName(author)}
  </Link>
);

export default AuthorLink;
