import { htmlToText } from '../lib/format';
import { fileToAvatarDataUrl, fileToResizedDataUrl } from '../lib/image';
import { REPORT_REASONS } from '../lib/reports';
import { getSession } from '../lib/session';
import {
  seedBlogs,
  seedBookmarks,
  seedComments,
  seedFollows,
  seedLikes,
  seedNotifications,
  seedUsers,
} from './seed';

// A tiny fake backend stored in localStorage. It mirrors the functions in realApi.js,
// so the whole UI can be built and tested before the Django side is ready.
const KEY = 'monolith_mock_db_v2';
const PAGE_SIZE = 10;
// The fake delay makes loading states visible in the browser. Tests (vitest sets MODE to
// 'test') skip it so they run fast.
const SKIP_DELAY = import.meta.env?.MODE === 'test';
const wait = (ms = 200) => (SKIP_DELAY ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms)));

// An error carrying status 404, like a real API's "not found" response.
const notFound = (message) => Object.assign(new Error(message), { status: 404 });

// Data saved by an older version of the app is topped up with the newer parts.
const upgrade = (db) => {
  db.notifications ??= structuredClone(seedNotifications);
  db.reports ??= [];
  db.likes ??= structuredClone(seedLikes);
  db.bookmarks ??= structuredClone(seedBookmarks);
  db.users.forEach((u) => {
    if (!('avatar' in u)) u.avatar = seedUsers.find((s) => s.id === u.id)?.avatar ?? null;
  });
  return db;
};

const load = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return upgrade(JSON.parse(raw));
  } catch {
    /* fall through to seed data */
  }
  return structuredClone({
    users: seedUsers,
    blogs: seedBlogs,
    comments: seedComments,
    follows: seedFollows,
    notifications: seedNotifications,
    reports: [],
    likes: seedLikes,
    bookmarks: seedBookmarks,
  });
};

const save = (db) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    throw new Error("Browser storage is full. Delete a post or clear this site's data and try again.");
  }
};

const nextId = (rows) => rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
const newest = (field) => (a, b) => new Date(b[field]) - new Date(a[field]);
const oldest = (field) => (a, b) => new Date(a[field]) - new Date(b[field]);

// Returns one page of rows, plus whether another page exists.
const paginate = (rows, page = 1) => {
  const start = (page - 1) * PAGE_SIZE;
  return { results: rows.slice(start, start + PAGE_SIZE), hasMore: start + PAGE_SIZE < rows.length };
};

// What the logged-in user sees about themselves (includes email).
const privateUser = (u) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  first_name: u.first_name,
  last_name: u.last_name,
  date_joined: u.date_joined,
  avatar: u.avatar ?? null,
});

const viewerOf = (db) => {
  const session = getSession();
  return (session && db.users.find((u) => u.id === session.user.id)) || null;
};

const requireViewer = (db) => {
  const viewer = viewerOf(db);
  if (!viewer) throw new Error('You need to log in first.');
  return viewer;
};

const isFollowing = (db, followerId, targetId) =>
  db.follows.some((f) => f.follower === followerId && f.following === targetId);

// The small "person" object embedded in blogs, comments and follow lists. No email.
const personOf = (db, userId, viewer) => {
  const u = db.users.find((x) => x.id === userId);
  if (!u) {
    return { id: userId, username: 'deleted', first_name: '', last_name: '', avatar: null, is_following: false };
  }
  return {
    id: u.id,
    username: u.username,
    first_name: u.first_name,
    last_name: u.last_name,
    avatar: u.avatar ?? null,
    is_following: viewer ? isFollowing(db, viewer.id, u.id) : false,
  };
};

const hasMark = (db, key, userId, blogId) =>
  db[key].some((m) => m.user_id === userId && m.blog_id === blogId);

// Adds or removes the viewer's like / bookmark. Doing it twice changes nothing.
const setMark = (db, key, userId, blogId, on) => {
  if (on && !hasMark(db, key, userId, blogId)) {
    db[key].push({ user_id: userId, blog_id: blogId, created_at: new Date().toISOString() });
  } else if (!on) {
    db[key] = db[key].filter((m) => !(m.user_id === userId && m.blog_id === blogId));
  }
};

// Counts are public. liked_by_me / bookmarked_by_me are about the person asking.
// Who bookmarked a post is never exposed, only the viewer's own flag.
const serializeBlog = (db, blog, viewer) => {
  const { author_id, ...rest } = blog;
  return {
    ...rest,
    author: personOf(db, author_id, viewer),
    likes_count: db.likes.filter((l) => l.blog_id === blog.id).length,
    comments_count: db.comments.filter((c) => c.blog === blog.id).length,
    liked_by_me: viewer ? hasMark(db, 'likes', viewer.id, blog.id) : false,
    bookmarked_by_me: viewer ? hasMark(db, 'bookmarks', viewer.id, blog.id) : false,
  };
};

// A simple "recommended" score: popular posts (likes, and comments counted double) rank
// higher, and the score fades as a post gets older so new posts get a chance.
// A real backend would decide this itself, possibly using what the reader likes and follows.
const recommendScore = (db, blog) => {
  const likes = db.likes.filter((l) => l.blog_id === blog.id).length;
  const comments = db.comments.filter((c) => c.blog === blog.id).length;
  const ageDays = Math.max(0, (Date.now() - new Date(blog.published_at).getTime()) / 86400000);
  return (likes + 2 * comments + 1) / Math.pow(ageDays + 2, 1.5);
};

// How many of a user's liked / bookmarked posts are still published (what their lists show).
const markedCount = (db, key, userId) =>
  db[key].filter(
    (m) => m.user_id === userId && db.blogs.some((b) => b.id === m.blog_id && b.status === 'published')
  ).length;

// One page of the viewer's liked or bookmarked posts, most recently marked first.
// Posts that were deleted or turned back into drafts are skipped.
const markedBlogs = (db, key, viewer, page) => {
  const rows = db[key]
    .filter((m) => m.user_id === viewer.id)
    .sort(newest('created_at'))
    .map((m) => db.blogs.find((b) => b.id === m.blog_id))
    .filter((b) => b && b.status === 'published');
  const { results, hasMore } = paginate(rows, page);
  return { results: results.map((b) => serializeBlog(db, b, viewer)), hasMore };
};

// Drafts are only visible to their author.
const findVisibleBlog = (db, id, viewer) => {
  const blog = db.blogs.find((b) => b.id === Number(id));
  if (!blog || (blog.status !== 'published' && blog.author_id !== viewer?.id)) {
    throw notFound('Blog not found.');
  }
  return blog;
};

const findOwnBlog = (db, id, viewer, verb) => {
  const blog = db.blogs.find((b) => b.id === Number(id));
  if (!blog) throw notFound('Blog not found.');
  if (blog.author_id !== viewer.id) throw new Error(`You can only ${verb} your own blogs.`);
  return blog;
};

const findUserByUsername = (db, username) => {
  const user = db.users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user) throw notFound('User not found.');
  return user;
};

const cleanPayload = ({ title, body, status }) => {
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) throw new Error('A title is required.');
  if (!['draft', 'published'].includes(status)) throw new Error('Status must be draft or published.');
  if (status === 'published' && !htmlToText(body || '')) {
    throw new Error('Add some content before publishing.');
  }
  return { title: cleanTitle, body: body || '', status };
};

const resolveCover = async (current, { cover, removeCover }) => {
  if (cover) return fileToResizedDataUrl(cover);
  if (removeCover) return null;
  return current;
};

// The text a search looks at, depending on the chosen field.
const searchText = (db, blog, by) => {
  if (by === 'content') return htmlToText(blog.body);
  if (by === 'author') {
    const author = db.users.find((u) => u.id === blog.author_id);
    return [author?.first_name, author?.last_name, author?.username].filter(Boolean).join(' ');
  }
  return blog.title;
};

// Adds a notification for `userId`. You are never notified about your own actions.
const notify = (db, { userId, type, actorId, blogId = null }) => {
  if (userId === actorId) return;
  db.notifications.push({
    id: nextId(db.notifications),
    user_id: userId,
    type,
    actor_id: actorId,
    blog_id: blogId,
    created_at: new Date().toISOString(),
    is_read: false,
  });
};

// Everyone who follows the author hears about a newly published post.
const notifyFollowersOfPost = (db, blog) => {
  db.follows
    .filter((f) => f.following === blog.author_id)
    .forEach((f) =>
      notify(db, { userId: f.follower, type: 'new_post', actorId: blog.author_id, blogId: blog.id })
    );
};

const mockApi = {
  // ---------- auth ----------
  login: async ({ username, password }) => {
    await wait();
    const user = load().users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );
    if (!user) throw new Error('Invalid username or password.');
    return { token: `mock-token-${user.id}`, user: privateUser(user) };
  },

  register: async ({ first_name, last_name, username, email, password }) => {
    await wait();
    const db = load();
    if (db.users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())) {
      throw new Error('That username is already taken.');
    }
    const user = {
      id: nextId(db.users),
      username: username.trim(),
      email: email.trim(),
      password,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      date_joined: new Date().toISOString(),
      avatar: null,
    };
    db.users.push(user);
    save(db);
    return { token: `mock-token-${user.id}`, user: privateUser(user) };
  },

  logout: async () => {
    await wait(80);
    return null;
  },

  forgotPassword: async () => {
    await wait();
    // Same answer either way, so the form never reveals which emails have accounts.
    return { detail: 'If an account exists for that email, a reset link is on its way.' };
  },

  // ---------- blogs ----------
  // The home feed: published posts. feed = 'latest' (newest first) | 'following' | 'recommended'
  // (most popular first, never your own posts). No searching here.
  listBlogs: async ({ feed = 'latest', page = 1 } = {}) => {
    await wait();
    const db = load();
    const viewer = viewerOf(db);
    if (feed === 'following' && !viewer) {
      throw new Error('Log in to see posts from people you follow.');
    }
    const followed = new Set(
      db.follows.filter((f) => f.follower === viewer?.id).map((f) => f.following)
    );
    let rows = db.blogs
      .filter((b) => b.status === 'published')
      .filter((b) => feed !== 'following' || followed.has(b.author_id));
    if (feed === 'recommended') {
      rows = rows
        .filter((b) => b.author_id !== viewer?.id)
        .map((blog) => ({ blog, score: recommendScore(db, blog) }))
        .sort((a, b) => b.score - a.score || new Date(b.blog.published_at) - new Date(a.blog.published_at))
        .map(({ blog }) => blog);
    } else {
      rows = rows.sort(newest('published_at'));
    }
    const { results, hasMore } = paginate(rows, page);
    return { results: results.map((b) => serializeBlog(db, b, viewer)), hasMore };
  },

  // The search page: published posts matching `q` in one field. by = 'title' | 'content' | 'author'
  searchBlogs: async ({ q, by = 'title', page = 1 }) => {
    await wait();
    const db = load();
    const viewer = viewerOf(db);
    const needle = (q || '').trim().toLowerCase();
    if (!needle) return { results: [], hasMore: false };
    const rows = db.blogs
      .filter((b) => b.status === 'published')
      .filter((b) => searchText(db, b, by).toLowerCase().includes(needle))
      .sort(newest('published_at'));
    const { results, hasMore } = paginate(rows, page);
    return { results: results.map((b) => serializeBlog(db, b, viewer)), hasMore };
  },

  // The logged-in user's own posts, filtered by status ('published' | 'draft').
  listMyBlogs: async ({ status }) => {
    await wait();
    const db = load();
    const viewer = requireViewer(db);
    return db.blogs
      .filter((b) => b.author_id === viewer.id && b.status === status)
      .sort(newest('updated_at'))
      .map((b) => serializeBlog(db, b, viewer));
  },

  getBlog: async (id) => {
    await wait();
    const db = load();
    const viewer = viewerOf(db);
    return serializeBlog(db, findVisibleBlog(db, id, viewer), viewer);
  },

  // payload: { title, body (HTML), status, cover (File | null) }
  createBlog: async (payload) => {
    await wait();
    const db = load();
    const viewer = requireViewer(db);
    const data = cleanPayload(payload);
    const now = new Date().toISOString();
    const blog = {
      id: nextId(db.blogs),
      ...data,
      cover_image: await resolveCover(null, payload),
      author_id: viewer.id,
      created_at: now,
      updated_at: now,
      published_at: data.status === 'published' ? now : null,
    };
    db.blogs.push(blog);
    if (blog.status === 'published') notifyFollowersOfPost(db, blog);
    save(db);
    return serializeBlog(db, blog, viewer);
  },

  // payload: { title, body, status, cover (File | null), removeCover (boolean) }
  updateBlog: async (id, payload) => {
    await wait();
    const db = load();
    const viewer = requireViewer(db);
    const blog = findOwnBlog(db, id, viewer, 'edit');
    const data = cleanPayload(payload);
    const now = new Date().toISOString();
    Object.assign(blog, data, {
      cover_image: await resolveCover(blog.cover_image, payload),
      updated_at: now,
    });
    if (data.status === 'published' && !blog.published_at) {
      blog.published_at = now;
      notifyFollowersOfPost(db, blog);
    }
    save(db);
    return serializeBlog(db, blog, viewer);
  },

  deleteBlog: async (id) => {
    await wait();
    const db = load();
    const viewer = requireViewer(db);
    const blog = findOwnBlog(db, id, viewer, 'delete');
    db.blogs = db.blogs.filter((b) => b.id !== blog.id);
    db.comments = db.comments.filter((c) => c.blog !== blog.id);
    db.likes = db.likes.filter((l) => l.blog_id !== blog.id);
    db.bookmarks = db.bookmarks.filter((b) => b.blog_id !== blog.id);
    db.notifications = db.notifications.filter((n) => n.blog_id !== blog.id);
    save(db);
    return null;
  },

  // ---------- comments ----------
  listComments: async (blogId) => {
    await wait(150);
    const db = load();
    const viewer = viewerOf(db);
    findVisibleBlog(db, blogId, viewer);
    return db.comments
      .filter((c) => c.blog === Number(blogId))
      .sort(oldest('created_at'))
      .map(({ author_id, ...rest }) => ({ ...rest, author: personOf(db, author_id, viewer) }));
  },

  addComment: async (blogId, { body }) => {
    await wait(150);
    const db = load();
    const viewer = requireViewer(db);
    const blog = findVisibleBlog(db, blogId, viewer);
    if (blog.status !== 'published') throw new Error('Comments are only open on published posts.');
    const comment = {
      id: nextId(db.comments),
      blog: blog.id,
      author_id: viewer.id,
      body: body.trim(),
      created_at: new Date().toISOString(),
    };
    db.comments.push(comment);
    notify(db, { userId: blog.author_id, type: 'comment', actorId: viewer.id, blogId: blog.id });
    save(db);
    const { author_id, ...rest } = comment;
    return { ...rest, author: personOf(db, author_id, viewer) };
  },

  deleteComment: async (blogId, commentId) => {
    await wait(150);
    const db = load();
    const viewer = requireViewer(db);
    const comment = db.comments.find((c) => c.id === Number(commentId));
    if (!comment) throw notFound('Comment not found.');
    if (comment.author_id !== viewer.id) throw new Error('You can only delete your own comments.');
    db.comments = db.comments.filter((c) => c.id !== comment.id);
    save(db);
    return null;
  },

  // ---------- your own profile (private: includes email) ----------
  getProfile: async () => {
    await wait();
    const db = load();
    const viewer = requireViewer(db);
    const mine = db.blogs.filter((b) => b.author_id === viewer.id);
    return {
      ...privateUser(viewer),
      posts_count: mine.filter((b) => b.status === 'published').length,
      drafts_count: mine.filter((b) => b.status === 'draft').length,
      followers_count: db.follows.filter((f) => f.following === viewer.id).length,
      following_count: db.follows.filter((f) => f.follower === viewer.id).length,
      liked_count: markedCount(db, 'likes', viewer.id),
      bookmarks_count: markedCount(db, 'bookmarks', viewer.id),
    };
  },

  // ---------- public profiles (anyone can read; never includes email or drafts) ----------
  getPublicProfile: async (username) => {
    await wait();
    const db = load();
    const viewer = viewerOf(db);
    const user = findUserByUsername(db, username);
    return {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      date_joined: user.date_joined,
      avatar: user.avatar ?? null,
      posts_count: db.blogs.filter((b) => b.author_id === user.id && b.status === 'published').length,
      followers_count: db.follows.filter((f) => f.following === user.id).length,
      following_count: db.follows.filter((f) => f.follower === user.id).length,
      is_following: viewer ? isFollowing(db, viewer.id, user.id) : false,
    };
  },

  listUserBlogs: async (username, { page = 1 } = {}) => {
    await wait();
    const db = load();
    const viewer = viewerOf(db);
    const user = findUserByUsername(db, username);
    const rows = db.blogs
      .filter((b) => b.author_id === user.id && b.status === 'published')
      .sort(newest('published_at'));
    const { results, hasMore } = paginate(rows, page);
    return { results: results.map((b) => serializeBlog(db, b, viewer)), hasMore };
  },

  // ---------- follows ----------
  listFollowing: async () => {
    await wait();
    const db = load();
    const viewer = requireViewer(db);
    return db.follows
      .filter((f) => f.follower === viewer.id)
      .map((f) => personOf(db, f.following, viewer));
  },

  listFollowers: async () => {
    await wait();
    const db = load();
    const viewer = requireViewer(db);
    return db.follows
      .filter((f) => f.following === viewer.id)
      .map((f) => personOf(db, f.follower, viewer));
  },

  follow: async (userId) => {
    await wait(120);
    const db = load();
    const viewer = requireViewer(db);
    const target = Number(userId);
    if (target === viewer.id) throw new Error("You can't follow yourself.");
    if (!db.users.some((u) => u.id === target)) throw notFound('User not found.');
    if (!isFollowing(db, viewer.id, target)) {
      db.follows.push({ follower: viewer.id, following: target });
      const alreadyTold = db.notifications.some(
        (n) => n.user_id === target && n.type === 'follow' && n.actor_id === viewer.id && !n.is_read
      );
      if (!alreadyTold) notify(db, { userId: target, type: 'follow', actorId: viewer.id });
      save(db);
    }
    return null;
  },

  unfollow: async (userId) => {
    await wait(120);
    const db = load();
    const viewer = requireViewer(db);
    const target = Number(userId);
    db.follows = db.follows.filter((f) => !(f.follower === viewer.id && f.following === target));
    save(db);
    return null;
  },

  // ---------- public follower / following lists (anyone can read, paginated) ----------
  listUserFollowers: async (username, { page = 1 } = {}) => {
    await wait();
    const db = load();
    const viewer = viewerOf(db);
    const user = findUserByUsername(db, username);
    const rows = db.follows.filter((f) => f.following === user.id).reverse();
    const { results, hasMore } = paginate(rows, page);
    return { results: results.map((f) => personOf(db, f.follower, viewer)), hasMore };
  },

  listUserFollowing: async (username, { page = 1 } = {}) => {
    await wait();
    const db = load();
    const viewer = viewerOf(db);
    const user = findUserByUsername(db, username);
    const rows = db.follows.filter((f) => f.follower === user.id).reverse();
    const { results, hasMore } = paginate(rows, page);
    return { results: results.map((f) => personOf(db, f.following, viewer)), hasMore };
  },

  // ---------- likes ----------
  // Each returns { liked, likes_count } so the UI can settle on the real number.
  likeBlog: async (id) => {
    await wait(120);
    const db = load();
    const viewer = requireViewer(db);
    const blog = findVisibleBlog(db, id, viewer);
    if (blog.status !== 'published') throw new Error('Only published posts can be liked.');
    const alreadyLiked = hasMark(db, 'likes', viewer.id, blog.id);
    setMark(db, 'likes', viewer.id, blog.id, true);
    // Tell the author, once per person per post (re-liking after an unlike stays quiet).
    const alreadyTold = db.notifications.some(
      (n) => n.user_id === blog.author_id && n.type === 'like' && n.actor_id === viewer.id && n.blog_id === blog.id
    );
    if (!alreadyLiked && !alreadyTold) {
      notify(db, { userId: blog.author_id, type: 'like', actorId: viewer.id, blogId: blog.id });
    }
    save(db);
    return { liked: true, likes_count: db.likes.filter((l) => l.blog_id === blog.id).length };
  },

  unlikeBlog: async (id) => {
    await wait(120);
    const db = load();
    const viewer = requireViewer(db);
    const blog = findVisibleBlog(db, id, viewer);
    setMark(db, 'likes', viewer.id, blog.id, false);
    save(db);
    return { liked: false, likes_count: db.likes.filter((l) => l.blog_id === blog.id).length };
  },

  // People who liked a post, most recent first.
  listBlogLikers: async (id, { page = 1 } = {}) => {
    await wait();
    const db = load();
    const viewer = viewerOf(db);
    const blog = findVisibleBlog(db, id, viewer);
    const rows = db.likes.filter((l) => l.blog_id === blog.id).sort(newest('created_at'));
    const { results, hasMore } = paginate(rows, page);
    return { results: results.map((l) => personOf(db, l.user_id, viewer)), hasMore };
  },

  // The logged-in user's liked posts, most recently liked first.
  listLikedBlogs: async ({ page = 1 } = {}) => {
    await wait();
    const db = load();
    return markedBlogs(db, 'likes', requireViewer(db), page);
  },

  // ---------- bookmarks (private: only you can see yours) ----------
  bookmarkBlog: async (id) => {
    await wait(120);
    const db = load();
    const viewer = requireViewer(db);
    const blog = findVisibleBlog(db, id, viewer);
    if (blog.status !== 'published') throw new Error('Only published posts can be bookmarked.');
    setMark(db, 'bookmarks', viewer.id, blog.id, true);
    save(db);
    return { bookmarked: true };
  },

  unbookmarkBlog: async (id) => {
    await wait(120);
    const db = load();
    const viewer = requireViewer(db);
    const blog = findVisibleBlog(db, id, viewer);
    setMark(db, 'bookmarks', viewer.id, blog.id, false);
    save(db);
    return { bookmarked: false };
  },

  listBookmarkedBlogs: async ({ page = 1 } = {}) => {
    await wait();
    const db = load();
    return markedBlogs(db, 'bookmarks', requireViewer(db), page);
  },

  // ---------- profile picture ----------
  // changes: { avatar: File } to set a picture, or { removeAvatar: true } to clear it.
  updateAvatar: async ({ avatar, removeAvatar }) => {
    await wait();
    const db = load();
    const viewer = requireViewer(db);
    const user = db.users.find((u) => u.id === viewer.id);
    if (avatar) user.avatar = await fileToAvatarDataUrl(avatar);
    else if (removeAvatar) user.avatar = null;
    save(db);
    return privateUser(user);
  },

  // ---------- notifications ----------
  // Newest first, latest 30. `blog` is null for follow notifications.
  listNotifications: async () => {
    await wait(120);
    const db = load();
    const viewer = requireViewer(db);
    return db.notifications
      .filter((n) => n.user_id === viewer.id)
      .filter((n) => n.blog_id === null || db.blogs.some((b) => b.id === n.blog_id && b.status === 'published'))
      .sort(newest('created_at'))
      .slice(0, 30)
      .map((n) => {
        const blog = n.blog_id === null ? null : db.blogs.find((b) => b.id === n.blog_id);
        return {
          id: n.id,
          type: n.type,
          is_read: n.is_read,
          created_at: n.created_at,
          actor: personOf(db, n.actor_id, viewer),
          blog: blog ? { id: blog.id, title: blog.title } : null,
        };
      });
  },

  markNotificationRead: async (id) => {
    await wait(100);
    const db = load();
    const viewer = requireViewer(db);
    const note = db.notifications.find((n) => n.id === Number(id) && n.user_id === viewer.id);
    if (!note) throw notFound('Notification not found.');
    note.is_read = true;
    save(db);
    return null;
  },

  markAllNotificationsRead: async () => {
    await wait(100);
    const db = load();
    const viewer = requireViewer(db);
    db.notifications.forEach((n) => {
      if (n.user_id === viewer.id) n.is_read = true;
    });
    save(db);
    return null;
  },

  deleteNotification: async (id) => {
    await wait(100);
    const db = load();
    const viewer = requireViewer(db);
    const note = db.notifications.find((n) => n.id === Number(id) && n.user_id === viewer.id);
    if (!note) throw notFound('Notification not found.');
    db.notifications = db.notifications.filter((n) => n.id !== note.id);
    save(db);
    return null;
  },

  // ---------- reports ----------
  // { type: 'blog' | 'comment' | 'user', id, reason, details }
  createReport: async ({ type, id, reason, details = '' }) => {
    await wait();
    const db = load();
    const viewer = requireViewer(db);
    // The same checks a real server would make.
    if (!REPORT_REASONS[type]) throw new Error('Unknown report type.');
    if (!REPORT_REASONS[type].some((r) => r.value === reason)) throw new Error('Choose a reason.');
    if (reason === 'other' && !details.trim()) {
      throw new Error('Tell us a little more when you choose "Something else".');
    }

    let ownerId;
    if (type === 'blog') {
      ownerId = findVisibleBlog(db, id, viewer).author_id;
    } else if (type === 'comment') {
      const comment = db.comments.find((c) => c.id === Number(id));
      if (!comment) throw notFound('Comment not found.');
      ownerId = comment.author_id;
    } else if (type === 'user') {
      const user = db.users.find((u) => u.id === Number(id));
      if (!user) throw notFound('User not found.');
      ownerId = user.id;
    } else {
      throw new Error('Unknown report type.');
    }

    if (ownerId === viewer.id) {
      throw new Error(type === 'user' ? "You can't report yourself." : "You can't report your own content.");
    }
    if (db.reports.some((r) => r.reporter_id === viewer.id && r.type === type && r.target_id === Number(id))) {
      throw new Error('You have already reported this. Our team will review it.');
    }

    db.reports.push({
      id: nextId(db.reports),
      type,
      target_id: Number(id),
      reason,
      details: details.trim(),
      reporter_id: viewer.id,
      status: 'open',
      created_at: new Date().toISOString(),
    });
    save(db);
    return null;
  },
};

export { mockApi };
