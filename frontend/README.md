# Monolith: Blog Frontend (React + Tailwind)

React 18, React Router 6, Vite, Tailwind CSS v4, Lucide icons and a Tiptap rich text editor. It runs on its own with a built-in mock API, and switches to your Django REST backend with one setting.

Black and white only for now: no colours, themes or animations, just a few hover effects.

Code style: `const` arrow functions only, and every `export` at the end of its file.

## Run it

```bash
npm install
npm run dev
npm test        # unit tests (vitest)
```

Open http://localhost:5173. Log in with `demo` / `demo1234` (or sign up). Other demo accounts: `asha` / `asha1234`, `ravi` / `ravi1234`. In mock mode all data lives in your browser's localStorage; clear site data to reset it.

To see notifications arrive, act as one account and look as another: for example, log in as `ravi`, comment on one of demo's posts, then log in as `demo` and open the bell.

## Pages

| Page | Route | Notes |
| --- | --- | --- |
| Home (feed) | `/` | **Latest / Following / Recommended** tabs, "Load more". No search here. Following needs a login. |
| Search | `/search?q=react&by=title&page=2` | `by` is `title`, `content` or `author`. Previous / Next pages. Shareable URLs. |
| Blog display | `/blogs/:id` | Cover image, body, like, bookmark, comment count, who liked it, follow, report, edit/delete for the author, comments |
| Public profile | `/users/:username` | Picture, name, username, join date, counts, published posts, follow and report, popup lists of followers and following. No email, no drafts. |
| Write | `/write`, `/write/:id` | Title, cover image, Tiptap body, **Save as draft** and **Publish** |
| Dashboard | `/dashboard?tab=posts` | Your private details, profile picture upload, tabs for Posts, Drafts, Liked, Bookmarks, Following, Followers |
| Log in / Sign up / Forgot password | `/login`, `/register`, `/forgot-password` | |

## Navbar

- Logged out: search, Log in, Sign up.
- Logged in: search, a **notification bell** and a **profile-picture menu** (Dashboard, Write, Public profile, Log out).
- The menu closes on outside click or Escape, and works with the keyboard (Arrow keys, Home, End).

### Notifications

The bell opens a floating panel, not a page. A dot on the bell shows while anything is unread (no count). Each notification can be **marked as read** (it stays, grayed out) or **deleted** (it disappears for good). Clicking a notification opens what it is about and marks it read. The list refreshes when the panel opens and once a minute.

Types: someone followed you, someone commented on your post, **someone liked your post**, someone you follow published a post. In mock mode these are created by the actions above. In the real app the **backend** creates them (see `BACKEND.md`); the panel just shows what it is given.

**Mark all as read** appears in the panel header whenever something is unread.

### Reports

A **Report** button opens a small form with a reason (and optional details) for:

| What | Where the button is |
| --- | --- |
| A blog post | Blog page, next to Follow |
| A comment | Under each comment that is not yours |
| A user | Their public profile, next to Follow |

Only logged-in people see it, and never on their own content. Each person can report a given item once.

### Feed tabs

- **Latest:** newest first. **Following:** posts from people you follow (logged-in only). **Recommended:** chosen by the backend (`feed=recommended`). Logged-out readers see Latest and Recommended.
- The mock ranks Recommended by popularity (likes, with comments counted double) fading with age, and never includes your own posts. The real ranking is up to your backend.

### Errors, 404s and page titles

- A crash on one page shows a "Something went wrong" message with Reload / Go home, and the navbar still works (`ErrorBoundary`).
- A missing post or user (API answers **404**) shows a proper "not found" page.
- If the API answers **401** while you are logged in (expired token), the saved login is cleared and you are shown as logged out.
- Every page sets the browser tab title (`useDocumentTitle`).

### Likes, bookmarks and counts

- **Like** (heart) and **Bookmark** sit under the byline on a post. Logged-out readers are sent to log in and returned to the post. Drafts can't be liked or bookmarked.
- The heart and bookmark change instantly and go back if the server refuses.
- **Bookmarks are private.** Only you see them (Dashboard, Bookmarks tab). Nobody, not even the author, sees who bookmarked a post or how many did.
- **Liked** and **Bookmarks** tabs on the Dashboard list the posts, most recent first, a page at a time.
- **Counts:** likes and comments show on post cards, the blog page and your own posts in the Dashboard. Format: 0 to 999 as is, then two digits rounded down: `1.2K`, `15K`, `120K`, `1.2M` (and `B`). The exact number shows on hover. The code is `formatCount` in `src/lib/format.js`.

### People lists

| List | Where |
| --- | --- |
| Who liked a post | "Who liked this" on the blog page |
| A person's followers | Click **Followers** on their public profile |
| Who a person follows | Click **Following** on their public profile |
| Your own followers and following | Dashboard tabs |

The popups load a page at a time ("Load more"), link to each person's profile and have a Follow button (not for yourself, not when logged out). There is deliberately no "who bookmarked" list.

### Pagination

- **Search** shows one page at a time with **Previous / Next**, and the page is in the URL (`?page=2`). The API only reports whether another page exists, so there are no page numbers to jump to. If you want them, return `count` and use `Math.ceil(count / page_size)`.
- The **feed**, a profile's posts, the popup lists and the Liked / Bookmarks tabs use **Load more**.
- Dashboard Posts, Drafts, Following and Followers load everything at once for now.

### Profile pictures

Upload or remove yours on the Dashboard. They are shown in the navbar menu, the dashboard, the public profile, beside author names on post cards and the blog page, beside commenters, in Following / Followers lists, and in notifications. With no picture, the person's initials are shown.

## Project layout

```
src/
  api/          index.js (mock or real), mockApi.js, realApi.js, seed.js
  components/
    layout/     Layout, Navbar, Footer, UserMenu, NotificationBell
    ...         Avatar, AuthorLink, SearchBar, BlogList, BlogCard, NotificationItem,
                Modal, ReportDialog, ReportButton, FollowButton, CommentSection,
                LikeButton, BookmarkButton, PostStats, PeopleDialog, Pagination, ErrorBoundary,
                RichTextEditor, RichContent, PostRow, UserRow, Tabs, Notice, PasswordInput
  context/      AuthContext (login, register, logout, updateUser)
  hooks/        useAsync, usePaginatedList, useNotifications, useDismiss, useDocumentTitle
  lib/          format.js, search.js, reports.js, image.js, session.js
  pages/        one file per route
  index.css     Tailwind setup, colour tokens, small reusable classes
tests/          vitest unit tests: format.js, the mock API, the real API (with a fake fetch)
dev-tools/      optional offline checkers for sandboxes without npm (safe to delete)
```

## Adding colour later

Every component uses four tokens defined in `src/index.css`:

```css
@theme static {
  --color-ink: #000000;     /* text, borders, primary buttons */
  --color-paper: #ffffff;   /* backgrounds */
  --color-muted: #525252;   /* secondary text */
  --color-subtle: #f5f5f5;  /* quiet backgrounds */
}
```

## Connecting to Django

1. Copy `.env.example` to `.env` and set `VITE_USE_MOCK=false`.
2. Run Django on `127.0.0.1:8000`. In dev, Vite proxies `/api` and `/media` there, so no CORS setup is needed.
3. Open `src/api/realApi.js` and adjust the paths to match your `urls.py`.

Endpoints the UI calls (relative to `/api/v1`):

| Purpose | Request |
| --- | --- |
| Login / register / logout | `POST /auth/login/`, `/auth/register/`, `/auth/logout/` |
| Forgot password | `POST /auth/forgot-password/` with `{ email }` |
| Feed | `GET /blogs/?feed=latest\|following\|recommended&page=2` (published only; no `feed` means latest) |
| Search | `GET /blogs/search/?q=react&by=title&page=1` |
| My posts and drafts | `GET /blogs/mine/?status=published` or `draft` |
| Blog | `GET / PATCH / DELETE /blogs/:id/`, `POST /blogs/` |
| Comments | `GET / POST /blogs/:id/comments/`, `DELETE /blogs/:id/comments/:cid/` |
| My profile (private) | `GET /users/me/` |
| **Set / remove my picture** | `PATCH /users/me/` as multipart: `avatar` = the file, or an empty value to clear |
| Public profile | `GET /profiles/:username/` and `GET /profiles/:username/blogs/?page=1` |
| Follows | `GET /users/me/following/`, `GET /users/me/followers/`, `POST / DELETE /users/:id/follow/` |
| **Like / unlike** | `POST / DELETE /blogs/:id/like/` → `{ "liked": true, "likes_count": 12 }` |
| **Who liked a post** | `GET /blogs/:id/likes/?page=1` (people, newest first, public) |
| **My liked posts** | `GET /users/me/likes/?page=1` (blogs, most recently liked first) |
| **Bookmark / unbookmark** | `POST / DELETE /blogs/:id/bookmark/` → `{ "bookmarked": true }` |
| **My bookmarks** | `GET /users/me/bookmarks/?page=1` (blogs, private to me) |
| **Someone's followers / following** | `GET /profiles/:username/followers/?page=1` and `/following/?page=1` (people, public) |
| **Notifications** | `GET /notifications/` (newest first, the logged-in user's own) |
| | `POST /notifications/mark-all-read/` |
| | `PATCH /notifications/:id/` with `{ "is_read": true }` |
| | `DELETE /notifications/:id/` |
| **Report** | `POST /reports/` with `{ target_type, target_id, reason, details }` |

The feed, search, a profile's posts, my liked posts, my bookmarks, who liked a post and the followers / following lists are paginated with the standard DRF page shape (`{ count, next, previous, results }`). Blogs are sent as multipart form data because of the cover image.

### What the API needs for the new features

- **Avatar**: an `ImageField(null=True, blank=True)` on your user/profile model, and an `avatar` URL (or `null`) in every serializer that shows a person.
- **Notifications**: a model with the recipient, an actor, a `type` (`follow`, `comment` or `new_post`), an optional blog, `is_read` and `created_at`. Create them in your follow, comment and publish code (for example in the view, or with Django signals). Only the recipient may read, update or delete a notification.
- **Likes**: a table of (user, blog, created_at) with a unique pair. The `like` endpoints should be safe to repeat (liking twice stays one like). Count with `annotate(likes_count=Count('likes', distinct=True))` to avoid one query per post.
- **Bookmarks**: the same shape, but never serialize who bookmarked a post, only the viewer's own `bookmarked_by_me`.
- **Comment count**: `comments_count` on each blog, also with `annotate`.
- **Reports**: a model with the reporter, `target_type` (`blog`, `comment`, `user`), `target_id`, `reason`, `details`, a `status` for moderation and `created_at`. Good rules to enforce on the server: no reporting your own content, and one report per person per item.

### Response shapes the UI expects

```jsonc
// login and register (register also sends first_name, last_name, username, email, password)
{ "token": "...", "user": { "id": 1, "username": "demo", "email": "...", "first_name": "...", "last_name": "...", "avatar": "url or null" } }

// A "person" appears inside blogs, comments, follow lists and notifications. It never has an email.
{ "id": 2, "username": "asha", "first_name": "Asha", "last_name": "Menon", "avatar": "url or null", "is_following": false }

// blog
{ "id": 1, "title": "...", "body": "<p>HTML from Tiptap</p>", "cover_image": "url or null",
  "status": "published",                     // or "draft"
  "author": { /* person */ },
  "likes_count": 12, "comments_count": 3,
  "liked_by_me": false, "bookmarked_by_me": false,   // false for logged-out readers
  "created_at": "ISO", "updated_at": "ISO", "published_at": "ISO or null" }

// comment
{ "id": 1, "blog": 1, "body": "...", "created_at": "ISO", "author": { /* person */ } }

// GET /users/me/  (private, only for the logged-in user)
{ "id": 1, "username": "...", "email": "...", "first_name": "...", "last_name": "...", "avatar": "url or null",
  "date_joined": "ISO", "posts_count": 3, "drafts_count": 1, "followers_count": 2, "following_count": 4,
  "liked_count": 5, "bookmarks_count": 2 }   // published posts only, for the Dashboard tab counts

// GET /profiles/:username/  (public: use a separate serializer with NO email)
{ "id": 2, "username": "asha", "first_name": "Asha", "last_name": "Menon", "avatar": "url or null",
  "date_joined": "ISO", "posts_count": 2, "followers_count": 2, "following_count": 1, "is_following": false }

// notification: "blog" is null for follows
{ "id": 7, "type": "comment",                // "follow" | "comment" | "new_post"
  "is_read": false, "created_at": "ISO",
  "actor": { /* person */ },
  "blog": { "id": 5, "title": "Hello, Monolith" } }
```

Authentication is `Authorization: Token <key>` (DRF TokenAuthentication). For JWT, change `authHeader()` in `realApi.js`.

### Security note on rich text

Blog bodies are HTML written by users. The frontend sanitizes them with DOMPurify before display, but your Django API should sanitize on save too (for example with `nh3`).

## Known limits

- The notification list is the latest page only (30 in the mock), so the dot reflects those. It refreshes once a minute rather than instantly (no websockets).
- The dashboard lists for Posts, Drafts, Following and Followers are not paginated yet (Liked and Bookmarks are).
- Notifications for likes are displayed, but only your backend can create them for real. The mock does it so you can try it.
- Component tests (React Testing Library) are not written yet; see "Tests" below.
- Search has Previous / Next but no page numbers, because the API reports only whether a next page exists.
- A profile picture is changed only from the Dashboard.
- Reports are sent and stored here, but reviewing them happens in the separate admin panel, not in this client.

## Tests

`npm test` runs vitest (jsdom) over `tests/`:

- `format.test.js`: the count formatter (`1.2K`, `15K`, ...), names, excerpts.
- `mockApi.test.js`: the fake backend end to end: auth, the three feeds, search paging, likes, bookmarks, counts, people lists, notifications (including mark all), reports, 404 statuses, upgrading old saved data.
- `realApi.test.js`: every endpoint path and method from the table above, the DRF page conversion, 404 status, and the 401 logout.

Not covered yet: React components (buttons, dialogs, pages). Add `@testing-library/react` and test `LikeButton`, `PeopleDialog` and the notification bell first.

## Backend checklist

See **`BACKEND.md`** for everything the Django side must handle: endpoints, response shapes, rules, notifications, rate limiting, security, moderation.

## Ideas for next steps

- Component tests, then end-to-end tests (Playwright) once Django is connected
- Tags or categories, bio on the public profile, editing user details
- Grouped notifications ("Asha and 5 others liked ...") and live updates instead of polling
- Paginate the remaining Dashboard lists
- Reset-password confirmation page (the screen opened from the emailed link)
