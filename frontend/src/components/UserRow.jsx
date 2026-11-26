import AuthorLink from './AuthorLink';
import Avatar from './Avatar';
import FollowButton from './FollowButton';

// A person in a list, with a follow toggle. Set `showFollow={false}` to hide the toggle
// (for yourself, or when logged out).
const UserRow = ({ person, onFollowChange, showFollow = true }) => (
  <li className="flex items-center justify-between gap-4 border-b border-ink py-3 last:border-b-0">
    <div className="flex min-w-0 items-center gap-3">
      <Avatar user={person} size="md" />
      <div className="min-w-0">
        <p className="truncate font-medium">
          <AuthorLink author={person} />
        </p>
        <p className="truncate text-xs text-muted">@{person.username}</p>
      </div>
    </div>
    {showFollow && (
      <FollowButton
        key={person.id}
        userId={person.id}
        initialFollowing={person.is_following}
        onChange={onFollowChange}
      />
    )}
  </li>
);

export default UserRow;
