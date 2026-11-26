import { ArrowLeft, CalendarDays, LayoutDashboard, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import Avatar from '../components/Avatar';
import BlogList from '../components/BlogList';
import FollowButton from '../components/FollowButton';
import Notice from '../components/Notice';
import PeopleDialog from '../components/PeopleDialog';
import ReportButton from '../components/ReportButton';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { displayName, formatCount, formatDate } from '../lib/format';
import NotFound from './NotFound';

// A number with a label. Pass `onClick` to make the number open a list.
const Stat = ({ label, value, onClick }) => (
  <div>
    <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
    <dd className="text-xl font-bold">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-haspopup="dialog"
          aria-label={`${value} ${label.toLowerCase()}. View list`}
          title={`${value} ${label.toLowerCase()}`}
          className="hover:underline"
        >
          {formatCount(value)}
        </button>
      ) : (
        formatCount(value)
      )}
    </dd>
  </div>
);

// What any reader sees about a writer: picture, name, username, join date, counts and published
// posts. It deliberately has no email and no drafts.
const PublicProfile = () => {
  const { username } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [openList, setOpenList] = useState(null); // 'followers' | 'following' | null

  const profile = useAsync(() => api.getPublicProfile(username), [username]);
  const posts = usePaginatedList((page) => api.listUserBlogs(username, { page }), [username]);
  useDocumentTitle(profile.data ? displayName(profile.data) : '');

  if (profile.status === 404) {
    return (
      <NotFound title="User not found" message={`There is no one with the username @${username}.`} />
    );
  }
  if (profile.loading) return <p className="text-sm text-muted">Loading…</p>;
  if (profile.error) {
    return (
      <div className="space-y-4">
        <Notice>{profile.error}</Notice>
        <Link to="/" className="inline-flex items-center gap-1 text-sm underline">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to home
        </Link>
      </div>
    );
  }

  const person = profile.data;
  const isMe = Boolean(user) && user.id === person.id;

  // Keep the followers count in step with the follow button.
  const handleFollowChange = (nowFollowing) =>
    profile.setData({
      ...person,
      is_following: nowFollowing,
      followers_count: person.followers_count + (nowFollowing ? 1 : -1),
    });

  return (
    <div>
      <section className="card" aria-label="Profile">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar user={person} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">{displayName(person)}</h1>
              <p className="text-sm text-muted">@{person.username}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                <CalendarDays size={12} aria-hidden="true" />
                Joined {formatDate(person.date_joined)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMe ? (
              <Link to="/dashboard" className="btn btn-outline btn-sm">
                <LayoutDashboard size={14} aria-hidden="true" />
                Dashboard
              </Link>
            ) : isAuthenticated ? (
              <>
                <FollowButton
                  key={person.id}
                  userId={person.id}
                  initialFollowing={person.is_following}
                  onChange={handleFollowChange}
                />
                <ReportButton
                  variant="button"
                  type="user"
                  id={person.id}
                  subject={`@${person.username}`}
                />
              </>
            ) : (
              <Link
                to="/login"
                state={{ from: `/users/${encodeURIComponent(person.username)}` }}
                className="btn btn-outline btn-sm"
              >
                <LogIn size={14} aria-hidden="true" />
                Log in to follow
              </Link>
            )}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-ink pt-5">
          <Stat label="Posts" value={person.posts_count} />
          <Stat
            label="Followers"
            value={person.followers_count}
            onClick={() => setOpenList('followers')}
          />
          <Stat
            label="Following"
            value={person.following_count}
            onClick={() => setOpenList('following')}
          />
        </dl>

        {isMe && (
          <p className="mt-4 text-xs text-muted">
            This is how other readers see your profile. Your email and drafts are never shown.
          </p>
        )}
      </section>

      <PeopleDialog
        open={openList === 'followers'}
        onClose={() => setOpenList(null)}
        title={`Followers of ${displayName(person)}`}
        fetchPage={(page) => api.listUserFollowers(person.username, { page })}
        emptyMessage="No followers yet."
      />
      <PeopleDialog
        open={openList === 'following'}
        onClose={() => setOpenList(null)}
        title={`${displayName(person)} follows`}
        fetchPage={(page) => api.listUserFollowing(person.username, { page })}
        emptyMessage="Not following anyone yet."
      />

      <section className="mt-8" aria-labelledby="posts-heading">
        <h2 id="posts-heading" className="border-b border-ink pb-2 text-lg font-bold">
          Posts
        </h2>
        <div className="pt-5">
          <BlogList
            {...posts}
            emptyMessage={`${displayName(person)} has not published anything yet.`}
          />
        </div>
      </section>
    </div>
  );
};

export default PublicProfile;
