import { UserCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';

// Follow / unfollow toggle. Give it a `key` of the user id if it may be reused for another user.
const FollowButton = ({ userId, initialFollowing, onChange }) => {
  const [following, setFollowing] = useState(Boolean(initialFollowing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      if (following) await api.unfollow(userId);
      else await api.follow(userId);
      const next = !following;
      setFollowing(next);
      onChange?.(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs">{error}</span>}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={following ? 'Click to unfollow' : 'Follow'}
        className={`btn btn-sm ${following ? 'btn-outline' : 'btn-primary'}`}
      >
        {following ? (
          <UserCheck size={14} aria-hidden="true" />
        ) : (
          <UserPlus size={14} aria-hidden="true" />
        )}
        {following ? 'Following' : 'Follow'}
      </button>
    </span>
  );
};

export default FollowButton;
