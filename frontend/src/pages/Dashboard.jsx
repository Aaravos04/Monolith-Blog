import {
  AtSign,
  Bookmark,
  CalendarDays,
  Camera,
  File,
  FileText,
  Globe,
  Heart,
  Mail,
  Pencil,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Avatar from '../components/Avatar';
import BlogList from '../components/BlogList';
import Notice from '../components/Notice';
import PostRow from '../components/PostRow';
import Tabs from '../components/Tabs';
import UserRow from '../components/UserRow';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { displayName, formatDate } from '../lib/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const TABS = [
  { key: 'posts', label: 'Posts', icon: FileText, countKey: 'posts_count' },
  { key: 'drafts', label: 'Drafts', icon: File, countKey: 'drafts_count' },
  { key: 'liked', label: 'Liked', icon: Heart, countKey: 'liked_count' },
  { key: 'bookmarks', label: 'Bookmarks', icon: Bookmark, countKey: 'bookmarks_count' },
  { key: 'following', label: 'Following', icon: UserCheck, countKey: 'following_count' },
  { key: 'followers', label: 'Followers', icon: Users, countKey: 'followers_count' },
];

// Short lists that load all at once.
const LOADERS = {
  posts: () => api.listMyBlogs({ status: 'published' }),
  drafts: () => api.listMyBlogs({ status: 'draft' }),
  following: () => api.listFollowing(),
  followers: () => api.listFollowers(),
};

// Lists that can grow long, so they load a page at a time ("Load more").
const PAGED_LOADERS = {
  liked: (options) => api.listLikedBlogs(options),
  bookmarks: (options) => api.listBookmarkedBlogs(options),
};

const EMPTY = {
  posts: 'You have not published anything yet.',
  drafts: 'No drafts. Anything you save as a draft shows up here.',
  liked: 'You have not liked any posts yet. Tap the heart on a post you enjoy.',
  bookmarks: 'No bookmarks yet. Tap Bookmark on a post to save it for later.',
  following: 'You are not following anyone yet. Follow writers from their posts or profiles.',
  followers: 'No followers yet.',
};

// Your private details (includes email) and your profile picture.
// Other readers see the public profile instead.
const ProfileCard = ({ profile, onAvatarSaved }) => {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const details = [
    { label: 'First name', value: profile.first_name || '-', icon: User },
    { label: 'Last name', value: profile.last_name || '-', icon: User },
    { label: 'Username', value: `@${profile.username}`, icon: AtSign },
    { label: 'Email', value: profile.email || '-', icon: Mail },
    { label: 'Member since', value: formatDate(profile.date_joined), icon: CalendarDays },
  ];

  const saveAvatar = async (changes) => {
    setBusy(true);
    setPhotoError('');
    try {
      const updated = await api.updateAvatar(changes);
      onAvatarSaved(updated.avatar ?? null);
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be picked again later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setPhotoError('The photo must be 2 MB or smaller.');
      return;
    }
    saveAvatar({ avatar: file });
  };

  return (
    <section className="card" aria-label="Your details">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar user={profile} size="xl" />
          <div className="min-w-0">
            <p className="truncate text-xl font-bold">{displayName(profile)}</p>
            <p className="text-sm text-muted">@{profile.username}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Camera size={14} aria-hidden="true" />
                {busy ? 'Saving…' : profile.avatar ? 'Change photo' : 'Add photo'}
              </button>
              {profile.avatar && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={busy}
                  onClick={() => saveAvatar({ removeAvatar: true })}
                >
                  <X size={14} aria-hidden="true" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <Link
          to={`/users/${encodeURIComponent(profile.username)}`}
          className="btn btn-outline btn-sm"
        >
          <Globe size={14} aria-hidden="true" />
          View public profile
        </Link>
      </div>

      {photoError && <Notice className="mt-4">{photoError}</Notice>}

      <dl className="mt-5 grid gap-4 border-t border-ink pt-5 text-sm sm:grid-cols-2">
        {details.map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-0.5 flex items-center gap-2">
              <Icon size={14} aria-hidden="true" />
              <span className="min-w-0 truncate">{value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

// Posts, drafts, following and followers.
const OwnList = ({ tab, onChanged }) => {
  const [actionError, setActionError] = useState('');
  const list = useAsync(() => LOADERS[tab](), [tab]);

  const handleDelete = async (blog) => {
    if (!window.confirm(`Delete "${blog.title || 'Untitled'}"? This cannot be undone.`)) return;
    setActionError('');
    try {
      await api.deleteBlog(blog.id);
      list.setData(list.data.filter((b) => b.id !== blog.id));
      onChanged();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const renderList = () => {
    const items = list.data || [];
    if (items.length === 0) return <p className="py-8 text-center text-muted">{EMPTY[tab]}</p>;

    if (tab === 'posts' || tab === 'drafts') {
      return (
        <ul>
          {items.map((blog) => (
            <PostRow key={blog.id} blog={blog} onDelete={handleDelete} />
          ))}
        </ul>
      );
    }
    return (
      <ul>
        {items.map((person) => (
          <UserRow key={person.id} person={person} onFollowChange={onChanged} />
        ))}
      </ul>
    );
  };

  return (
    <>
      {actionError && <Notice className="my-3">{actionError}</Notice>}
      {list.loading ? (
        <p className="py-6 text-sm text-muted">Loading…</p>
      ) : list.error ? (
        <Notice className="my-3">{list.error}</Notice>
      ) : (
        renderList()
      )}
    </>
  );
};

// Posts you liked or bookmarked, most recent first, a page at a time.
const MarkedList = ({ tab }) => {
  const list = usePaginatedList((page) => PAGED_LOADERS[tab]({ page }), [tab]);

  return (
    <div className="pt-4">
      {tab === 'bookmarks' && (
        <p className="mb-4 text-xs text-muted">Only you can see your bookmarks.</p>
      )}
      <BlogList {...list} emptyMessage={EMPTY[tab]} />
    </div>
  );
};

const Dashboard = () => {
  useDocumentTitle('Dashboard');
  const { updateUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab = TABS.some((t) => t.key === requested) ? requested : 'posts';

  const [profileKey, setProfileKey] = useState(0);

  const profile = useAsync(() => api.getProfile(), [profileKey]);

  const refreshProfile = () => setProfileKey((k) => k + 1);

  const tabs = TABS.map(({ key, label, icon, countKey }) => ({
    key,
    label,
    icon,
    count: profile.data?.[countKey],
  }));

  // Update this page and the navbar's picture.
  const handleAvatarSaved = (avatar) => {
    profile.setData({ ...profile.data, avatar });
    updateUser({ avatar });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/write" className="btn btn-primary">
          <Pencil size={16} aria-hidden="true" />
          New post
        </Link>
      </header>

      {profile.error && <Notice>{profile.error}</Notice>}
      {profile.data && <ProfileCard profile={profile.data} onAvatarSaved={handleAvatarSaved} />}

      <section>
        <Tabs tabs={tabs} active={tab} onChange={(key) => setParams({ tab: key })} />
        <div className="pt-2">
          {PAGED_LOADERS[tab] ? (
            <MarkedList key={tab} tab={tab} />
          ) : (
            <OwnList key={tab} tab={tab} onChanged={refreshProfile} />
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
