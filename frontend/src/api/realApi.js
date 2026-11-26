import { UNAUTHORIZED_EVENT, clearSession, getSession } from '../lib/session';

const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

// DRF TokenAuthentication uses "Token <key>". For JWT, change this to "Bearer <token>".
const authHeader = () => {
  const session = getSession();
  return session?.token ? { Authorization: `Token ${session.token}` } : {};
};

const request = async (path, { method = 'GET', body } = {}) => {
  const isForm = body instanceof FormData;
  const hasJson = body !== undefined && !isForm;

  const res = await fetch(`${BASE}${path}`, {
    method,
    // For FormData the browser sets the multipart Content-Type (with boundary) itself.
    headers: { ...(hasJson ? { 'Content-Type': 'application/json' } : {}), ...authHeader() },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (!res.ok) {
    // A saved login the server no longer accepts (expired or revoked token): forget it.
    // Wrong passwords at login come back without a saved session, so they are not affected.
    if (res.status === 401 && getSession()) {
      clearSession();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      // DRF returns either {"detail": "..."} or {"field": ["error", ...]}
      message =
      data.detail ||
      Object.entries(data)
      .map(([field, errs]) => `${field}: ${[].concat(errs).join(' ')}`)
          .join(' · ') ||
          message;
    } catch {
      /* response had no JSON body */
    }
    // The status lets pages tell "not found" (404) apart from other failures.
    throw Object.assign(new Error(message), { status: res.status });
  }
  
  return res.status === 204 ? null : res.json();
};

// Builds "?a=1&b=2", skipping empty values.
const query = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
};

// DRF list endpoints may be paginated ({ results: [...] }) or plain arrays.
const unwrap = (data) => (Array.isArray(data) ? data : data.results ?? []);

// Turns a DRF page ({ count, next, previous, results }) into what usePaginatedList expects.
const toPage = (data) =>
  Array.isArray(data)
    ? { results: data, hasMore: false }
    : { results: data.results ?? [], hasMore: Boolean(data.next) };

// Blogs carry an image, so they are sent as multipart form data.
const blogFormData = ({ title, body, status, cover, removeCover }) => {
  const form = new FormData();
  form.append('title', title);
  form.append('body', body);
  form.append('status', status);
  if (cover) form.append('cover_image', cover);
  // To clear an ImageField via multipart, DRF needs allow_null=True and an empty value.
  else if (removeCover) form.append('cover_image', '');
  return form;
};

/*
 * Endpoint paths are placeholders based on /api/v1. Adjust them to your urls.py, and the
 * response shapes to your serializers (see the README for the shapes the UI expects).
 */
const realApi = {
  // auth
  login: (credentials) => request('/auth/login/', { method: 'POST', body: credentials }),
  register: (details) => request('/auth/register/', { method: 'POST', body: details }),
  logout: () => request('/auth/logout/', { method: 'POST' }),
  forgotPassword: (payload) => request('/auth/forgot-password/', { method: 'POST', body: payload }),

  // blogs
  listBlogs: ({ feed = 'latest', page = 1 } = {}) =>
    // feed is 'latest' (the default, sent as nothing), 'following' or 'recommended'
    request(`/blogs/${query({ feed: feed === 'latest' ? '' : feed, page })}`).then(toPage),
  searchBlogs: ({ q, by = 'title', page = 1 }) =>
    request(`/blogs/search/${query({ q, by, page })}`).then(toPage),
  listMyBlogs: ({ status }) => request(`/blogs/mine/${query({ status })}`).then(unwrap),
  getBlog: (id) => request(`/blogs/${id}/`),
  createBlog: (payload) => request('/blogs/', { method: 'POST', body: blogFormData(payload) }),
  updateBlog: (id, payload) =>
    request(`/blogs/${id}/`, { method: 'PATCH', body: blogFormData(payload) }),
  deleteBlog: (id) => request(`/blogs/${id}/`, { method: 'DELETE' }),

  // comments
  listComments: (blogId) => request(`/blogs/${blogId}/comments/`).then(unwrap),
  addComment: (blogId, payload) =>
    request(`/blogs/${blogId}/comments/`, { method: 'POST', body: payload }),
  deleteComment: (blogId, commentId) =>
    request(`/blogs/${blogId}/comments/${commentId}/`, { method: 'DELETE' }),

  // your own profile (private)
  getProfile: () => request('/users/me/'),
  // changes: { avatar: File } to set a picture, or { removeAvatar: true } to clear it.
  updateAvatar: ({ avatar, removeAvatar }) => {
    const form = new FormData();
    if (avatar) form.append('avatar', avatar);
    // To clear an ImageField via multipart, DRF needs allow_null=True and an empty value.
    else if (removeAvatar) form.append('avatar', '');
    return request('/users/me/', { method: 'PATCH', body: form });
  },

  // public profiles (no email, no drafts)
  getPublicProfile: (username) => request(`/profiles/${encodeURIComponent(username)}/`),
  listUserBlogs: (username, { page = 1 } = {}) =>
    request(`/profiles/${encodeURIComponent(username)}/blogs/${query({ page })}`).then(toPage),

  // follows
  listFollowing: () => request('/users/me/following/').then(unwrap),
  listFollowers: () => request('/users/me/followers/').then(unwrap),
  follow: (userId) => request(`/users/${userId}/follow/`, { method: 'POST' }),
  unfollow: (userId) => request(`/users/${userId}/follow/`, { method: 'DELETE' }),

  // public follower / following lists of any user (paginated)
  listUserFollowers: (username, { page = 1 } = {}) =>
    request(`/profiles/${encodeURIComponent(username)}/followers/${query({ page })}`).then(toPage),
  listUserFollowing: (username, { page = 1 } = {}) =>
    request(`/profiles/${encodeURIComponent(username)}/following/${query({ page })}`).then(toPage),

  // likes: like / unlike answer with { liked, likes_count }
  likeBlog: (id) => request(`/blogs/${id}/like/`, { method: 'POST' }),
  unlikeBlog: (id) => request(`/blogs/${id}/like/`, { method: 'DELETE' }),
  listBlogLikers: (id, { page = 1 } = {}) =>
    request(`/blogs/${id}/likes/${query({ page })}`).then(toPage),
  listLikedBlogs: ({ page = 1 } = {}) => request(`/users/me/likes/${query({ page })}`).then(toPage),

  // bookmarks (private): bookmark / unbookmark answer with { bookmarked }
  bookmarkBlog: (id) => request(`/blogs/${id}/bookmark/`, { method: 'POST' }),
  unbookmarkBlog: (id) => request(`/blogs/${id}/bookmark/`, { method: 'DELETE' }),
  listBookmarkedBlogs: ({ page = 1 } = {}) =>
    request(`/users/me/bookmarks/${query({ page })}`).then(toPage),

  // notifications (the list is for the logged-in user, newest first)
  listNotifications: () => request('/notifications/').then(unwrap),
  markNotificationRead: (id) =>
    request(`/notifications/${id}/`, { method: 'PATCH', body: { is_read: true } }),
  markAllNotificationsRead: () => request('/notifications/mark-all-read/', { method: 'POST' }),
  deleteNotification: (id) => request(`/notifications/${id}/`, { method: 'DELETE' }),

  // reports: type is 'blog', 'comment' or 'user'
  createReport: ({ type, id, reason, details = '' }) =>
    request('/reports/', { method: 'POST', body: { target_type: type, target_id: id, reason, details } }),
};

export { realApi };
